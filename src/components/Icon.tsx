import {
  TrendingUp, Trophy, Sparkles, Star, Users, Brain,
  Glasses, Target, AlertTriangle, Clock, Monitor,
  Gamepad2, Joystick,
} from 'lucide-react'
import {
  SiPlaystation, SiApple,
  SiAndroid, SiRoblox, SiFortnite, SiEpicgames, SiSteam,
} from '@icons-pack/react-simple-icons'

const ICONS = {
  trending:    TrendingUp,
  acclaimed:   Trophy,
  new:         Sparkles,
  topscore:    Star,
  family:      Users,
  teamwork:    Users,
  smart:       Brain,
  vr:          Glasses,
  beginner:    Target,
  warning:     AlertTriangle,
  time:        Clock,
  pc:          Monitor,
  playstation: SiPlaystation,
  xbox:        Gamepad2,
  switch:      Joystick,
  ios:         SiApple,
  android:     SiAndroid,
  roblox:      SiRoblox,
  fortnite:    SiFortnite,
  epicgames:   SiEpicgames,
  steam:       SiSteam,
} as const

export type IconName = keyof typeof ICONS

type IconProps = {
  name: IconName
  size?: number
  label?: string
  className?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIcon = (props: any) => JSX.Element

export default function Icon({ name, size = 20, label, className }: IconProps) {
  const Component = ICONS[name] as AnyIcon

  if (label) {
    return <Component size={size} role="img" aria-label={label} className={className} />
  }

  return <Component size={size} aria-hidden="true" className={className} />
}
