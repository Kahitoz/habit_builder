import {
  Brain,
  BookOpen,
  Coins,
  Dumbbell,
  Droplets,
  Flame,
  Heart,
  Leaf,
  ListTodo,
  Moon,
  Pencil,
  Star,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  droplets: Droplets,
  "book-open": BookOpen,
  dumbbell: Dumbbell,
  brain: Brain,
  pencil: Pencil,
  heart: Heart,
  coins: Coins,
  leaf: Leaf,
  moon: Moon,
  flame: Flame,
  target: Target,
  star: Star,
};

export function HabitIcon({
  icon,
  size = 16,
  className,
}: {
  icon: string | null;
  size?: number;
  className?: string;
}) {
  const Cmp = (icon && ICONS[icon]) || ListTodo;
  return <Cmp size={size} className={cn("shrink-0", className)} />;
}
