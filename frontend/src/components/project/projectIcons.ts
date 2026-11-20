import {
  BookOpen, Briefcase, Bug, Calendar, CircleCheck, Compass, Flame, FlaskConical, Folder, Globe, House,
  Lightbulb, Lock, MessageCircle, Music, Package, Palette, Pin, Rocket, Sprout, Star, Target, TrendingUp, Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { ProjectIconName } from '@/data/project'

// The drawing for each icon name in PROJECT_ICONS (data/project.ts).
export const PROJECT_ICON_COMPONENTS: Record<ProjectIconName, LucideIcon> = {
  rocket: Rocket, folder: Folder, pin: Pin, target: Target, lightbulb: Lightbulb, wrench: Wrench,
  'trending-up': TrendingUp, flask: FlaskConical, palette: Palette, music: Music, book: BookOpen, house: House,
  sprout: Sprout, star: Star, flame: Flame, message: MessageCircle, compass: Compass, package: Package,
  calendar: Calendar, check: CircleCheck, bug: Bug, lock: Lock, globe: Globe, briefcase: Briefcase,
}
