// LifeForge — Multibranch Pipeline.
//
// Builds the backend (FastAPI) and frontend (Next.js) with Podman, pushes
// commit-tagged images to the internal registry, and deploys to Kubernetes
// with kubectl. Traefik Ingress resources (with external-dns annotations)
// are generated at deploy time. Podman only, no secrets in this file.
//
// Safe path: run ACTION=ARTIFACT_ONLY with no registry/Kubernetes settings.

pipeline {
    agent { label 'prod-node' }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    parameters {
        choice(
            name: 'ACTION',
            choices: ['ARTIFACT_ONLY', 'BUILD', 'DEPLOY', 'BUILD_AND_DEPLOY'],
            description: 'ARTIFACT_ONLY: host build/test + archive (no deploy settings needed). BUILD: + build/push images. DEPLOY: apply manifests + ingress + rollout (image must exist). BUILD_AND_DEPLOY: build/push then deploy.'
        )
        choice(
            name: 'COMPONENT',
            choices: ['ALL', 'backend', 'frontend'],
            description: 'Which component(s) to build/test/deploy.'
        )
        string(
            name: 'K8S_NAMESPACE',
            defaultValue: 'demo',
            description: 'Target Kubernetes namespace. Hostnames become <service>.<ns>.kahitoz.com.'
        )
    }

    environment {
        KUBECONFIG     = '/var/lib/jenkins/.kube/config'
        PATH            = '/usr/local/bin:/usr/bin:/bin'
        REGISTRY        = '192.168.0.101:5000'
        IMAGE_TAG       = "${GIT_COMMIT.take(12)}"
        IMAGE_BACKEND   = "${REGISTRY}/lifeforge-backend:${GIT_COMMIT.take(12)}"
        IMAGE_FRONTEND  = "${REGISTRY}/lifeforge-frontend:${GIT_COMMIT.take(12)}"
        BACKEND_HOST    = "lifeforge-backend.${K8S_NAMESPACE}.kahitoz.com"
        FRONTEND_HOST   = "lifeforge-frontend.${K8S_NAMESPACE}.kahitoz.com"
    }

    stages {
        stage('Validate') {
            steps {
                script {
                    def action    = params.ACTION ?: 'ARTIFACT_ONLY'
                    def component = params.COMPONENT ?: 'ALL'
                    def validActions    = ['ARTIFACT_ONLY', 'BUILD', 'DEPLOY', 'BUILD_AND_DEPLOY']
                    def validComponents = ['ALL', 'backend', 'frontend']

                    if (!(action in validActions))        { error("Unsupported ACTION: ${action}") }
                    if (!(component in validComponents))  { error("Unsupported COMPONENT: ${component}") }
                    if (!params.K8S_NAMESPACE?.trim())    { error('K8S_NAMESPACE must not be empty.') }

                    def needsK8s = (action in ['DEPLOY', 'BUILD_AND_DEPLOY'])
                    if (needsK8s) {
                        // Namespace-scoped validation only (no cluster-wide checks).
                        sh '''#!/usr/bin/env bash
                            set -euo pipefail
                            kubectl auth can-i get deployments -n "$K8S_NAMESPACE"
                            kubectl get deployments -n "$K8S_NAMESPACE"
                        '''
                    }
                    echo "ACTION=${action} COMPONENT=${component} K8S_NAMESPACE=${K8S_NAMESPACE} needsK8s=${needsK8s}"
                }
            }
        }

        stage('Build and test') {
            when { expression { return params.ACTION in ['ARTIFACT_ONLY', 'BUILD', 'BUILD_AND_DEPLOY'] } }
            steps {
                script {
                    if (params.COMPONENT in ['ALL', 'backend']) {
                        // Backend deps install in the image, not on the host.
                        // The host runs a compile check only.
                        echo 'Backend: host compile check'
                        sh 'cd backend && python3 -m compileall -q app'
                    }
                    if (params.COMPONENT in ['ALL', 'frontend']) {
                        // Frontend production assets are built in the image; the host
                        // runs a TypeScript gate. (pnpm, not pip.)
                        echo 'Frontend: type check'
                        sh '''#!/usr/bin/env bash
                            set -euo pipefail
                            cd frontend
                            npx --yes pnpm@9 install --frozen-lockfile
                            npx --yes pnpm@9 typecheck
                        '''
                    }
                }
            }
        }

        stage('Build and push images') {
            when { expression { return params.ACTION in ['BUILD', 'BUILD_AND_DEPLOY'] } }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-registry',
                    usernameVariable: 'REG_USER',
                    passwordVariable: 'REG_PASS'
                )]) {
                    script {
                        def doBackend  = params.COMPONENT in ['ALL', 'backend']
                        def doFrontend = params.COMPONENT in ['ALL', 'frontend']

                        // One temporary auth file, reused for both login and push.
                        sh '''#!/usr/bin/env bash
                            set -euo pipefail
                            AUTH_FILE="$WORKSPACE/.podman-auth"
                            printf '%s' "$REG_PASS" | podman login \
                                --authfile "$AUTH_FILE" --tls-verify=false \
                                -u "$REG_USER" --password-stdin "$REGISTRY"
                        '''

                        if (doBackend) {
                            sh '''#!/usr/bin/env bash
                                set -euo pipefail
                                AUTH_FILE="$WORKSPACE/.podman-auth"
                                podman build -f backend/Containerfile -t "$IMAGE_BACKEND" backend/
                                podman push --authfile "$AUTH_FILE" --tls-verify=false "$IMAGE_BACKEND"
                            '''
                        }

                        if (doFrontend) {
                            // NEXT_PUBLIC_API_URL is a build-time value pointing at the
                            // backend hostname for the target namespace.
                            sh '''#!/usr/bin/env bash
                                set -euo pipefail
                                AUTH_FILE="$WORKSPACE/.podman-auth"
                                podman build \
                                    --build-arg NEXT_PUBLIC_API_URL="https://$BACKEND_HOST" \
                                    -f frontend/Containerfile -t "$IMAGE_FRONTEND" frontend/
                                podman push --authfile "$AUTH_FILE" --tls-verify=false "$IMAGE_FRONTEND"
                            '''
                        }
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            when { expression { return params.ACTION in ['DEPLOY', 'BUILD_AND_DEPLOY'] } }
            steps {
                script {
                    if (params.COMPONENT in ['ALL', 'backend']) {
                        sh '''#!/usr/bin/env bash
                            set -euo pipefail
                            CORS_VALUE='["https://'"${FRONTEND_HOST}"'"]'
                            sed -i "s|IMAGE_PLACEHOLDER|$IMAGE_BACKEND|g" deploy/k8s/backend.yaml
                            sed -i "s|CORS_ORIGINS_PLACEHOLDER|$CORS_VALUE|" deploy/k8s/backend.yaml
                            kubectl apply -n "$K8S_NAMESPACE" -f deploy/k8s/backend.yaml
                            kubectl set image -n "$K8S_NAMESPACE" \
                                deployment/lifeforge-backend "lifeforge-backend=$IMAGE_BACKEND"
                            kubectl rollout status -n "$K8S_NAMESPACE" \
                                deployment/lifeforge-backend --timeout=300s

                            cat <<EOF | kubectl apply -n "$K8S_NAMESPACE" -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: lifeforge-backend
  labels:
    app: lifeforge-backend
    app.kubernetes.io/part-of: lifeforge
  annotations:
    kubernetes.io/ingress.class: traefik
    external-dns.alpha.kubernetes.io/target: "100.70.0.0"
    external-dns.alpha.kubernetes.io/cloudflare-proxied: "false"
spec:
  rules:
    - host: $BACKEND_HOST
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: lifeforge-backend
                port:
                  number: 8000
EOF
                        '''
                    }

                    if (params.COMPONENT in ['ALL', 'frontend']) {
                        sh '''#!/usr/bin/env bash
                            set -euo pipefail
                            sed -i "s|IMAGE_PLACEHOLDER|$IMAGE_FRONTEND|g" deploy/k8s/frontend.yaml
                            kubectl apply -n "$K8S_NAMESPACE" -f deploy/k8s/frontend.yaml
                            kubectl set image -n "$K8S_NAMESPACE" \
                                deployment/lifeforge-frontend "lifeforge-frontend=$IMAGE_FRONTEND"
                            kubectl rollout status -n "$K8S_NAMESPACE" \
                                deployment/lifeforge-frontend --timeout=300s

                            cat <<EOF | kubectl apply -n "$K8S_NAMESPACE" -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: lifeforge-frontend
  labels:
    app: lifeforge-frontend
    app.kubernetes.io/part-of: lifeforge
  annotations:
    kubernetes.io/ingress.class: traefik
    external-dns.alpha.kubernetes.io/target: "100.70.0.0"
    external-dns.alpha.kubernetes.io/cloudflare-proxied: "false"
spec:
  rules:
    - host: $FRONTEND_HOST
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: lifeforge-frontend
                port:
                  number: 80
EOF
                        '''
                    }
                }
            }
        }

        stage('Archive') {
            when { expression { return params.ACTION in ['ARTIFACT_ONLY', 'BUILD'] } }
            steps {
                archiveArtifacts(
                    artifacts: 'Jenkinsfile,backend/Containerfile,frontend/Containerfile,deploy/k8s/*.yaml,deploy/README.md',
                    allowEmptyArchive: true,
                    fingerprint: true
                )
            }
        }
    }

    post {
        always {
            // Remove the temporary registry auth file (no-op if it was never created).
            sh 'rm -f "$WORKSPACE/.podman-auth"'
        }
        success {
            echo "Done. ACTION=${params.ACTION} COMPONENT=${params.COMPONENT} ns=${K8S_NAMESPACE} image-tag=${IMAGE_TAG}"
        }
        failure {
            echo "Pipeline failed. ACTION=${params.ACTION} COMPONENT=${params.COMPONENT} ns=${K8S_NAMESPACE}"
        }
    }
}
