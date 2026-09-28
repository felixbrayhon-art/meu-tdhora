import React from 'react';
import {
  ArrowCounterClockwise as PhArrowCounterClockwise,
  ArrowLeft as PhArrowLeft,
  ArrowLineLeft as PhArrowLineLeft,
  ArrowLineRight as PhArrowLineRight,
  ArrowRight as PhArrowRight,
  ArrowUUpLeft as PhArrowUUpLeft,
  ArrowUUpRight as PhArrowUUpRight,
  ArrowsIn as PhArrowsIn,
  ArrowsOut as PhArrowsOut,
  ArrowsOutCardinal as PhArrowsOutCardinal,
  ArrowsOutLineVertical as PhArrowsOutLineVertical,
  Bell as PhBell,
  Book as PhBook,
  BookOpen as PhBookOpen,
  Bookmark as PhBookmark,
  Brain as PhBrain,
  Briefcase as PhBriefcase,
  Calendar as PhCalendar,
  CaretDown as PhCaretDown,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  ChartBar as PhChartBar,
  ChatCircleText as PhChatCircleText,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  CheckSquare as PhCheckSquare,
  Circle as PhCircle,
  ClipboardText as PhClipboardText,
  Clock as PhClock,
  Cloud as PhCloud,
  Compass as PhCompass,
  Copy as PhCopy,
  Cursor as PhCursor,
  Database as PhDatabase,
  DotsThreeVertical as PhDotsThreeVertical,
  Download as PhDownload,
  Eraser as PhEraser,
  File as PhFile,
  FileText as PhFileText,
  Flag as PhFlag,
  FloppyDisk as PhFloppyDisk,
  Folder as PhFolder,
  FolderOpen as PhFolderOpen,
  FolderPlus as PhFolderPlus,
  Funnel as PhFunnel,
  Gear as PhGear,
  GearSix as PhGearSix,
  GraduationCap as PhGraduationCap,
  Heart as PhHeart,
  Highlighter as PhHighlighter,
  House as PhHouse,
  Image as PhImage,
  Info as PhInfo,
  Laptop as PhLaptop,
  Lightning as PhLightning,
  MagnifyingGlass as PhMagnifyingGlass,
  Minus as PhMinus,
  Newspaper as PhNewspaper,
  NotePencil as PhNotePencil,
  PaintBrush as PhPaintBrush,
  Palette as PhPalette,
  Path as PhPath,
  Pause as PhPause,
  Pencil as PhPencil,
  Pentagon as PhPentagon,
  Play as PhPlay,
  Plus as PhPlus,
  Question as PhQuestion,
  Ruler as PhRuler,
  Scales as PhScales,
  Scissors as PhScissors,
  ShareNetwork as PhShareNetwork,
  ShieldWarning as PhShieldWarning,
  Shuffle as PhShuffle,
  SignOut as PhSignOut,
  SkipForward as PhSkipForward,
  Smiley as PhSmiley,
  Sparkle as PhSparkle,
  SpeakerHigh as PhSpeakerHigh,
  SpeakerX as PhSpeakerX,
  SpinnerGap as PhSpinnerGap,
  Square as PhSquare,
  Stack as PhStack,
  TShirt as PhTShirt,
  Target as PhTarget,
  TextB as PhTextB,
  TextItalic as PhTextItalic,
  TextT as PhTextT,
  TextUnderline as PhTextUnderline,
  Timer as PhTimer,
  Trash as PhTrash,
  TrendUp as PhTrendUp,
  Trophy as PhTrophy,
  Moon as PhMoon,
  Sun as PhSun,
  Upload as PhUpload,
  User as PhUser,
  UserCircle as PhUserCircle,
  Users as PhUsers,
  Warning as PhWarning,
  WarningCircle as PhWarningCircle,
  X as PhX,
  XCircle as PhXCircle,
} from '@phosphor-icons/react';
import type { Icon as PhosphorIcon, IconWeight } from '@phosphor-icons/react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

// Icon set: Phosphor Icons (https://phosphoricons.com, MIT license), fill
// weight by default, re-exported under the app's original names so no
// call site needed to change. Bookmark/BookmarkCheck deliberately keep
// two different weights (outline vs filled) to preserve the saved/unsaved
// toggle they're used for.
const wrap = (PhIcon: PhosphorIcon, weight: IconWeight = 'fill') =>
  React.forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <PhIcon ref={ref} weight={weight} {...props} />
  ));

export const AlertCircle = wrap(PhWarningCircle, 'fill');
export const ArrowLeft = wrap(PhArrowLeft, 'fill');
export const ArrowRight = wrap(PhArrowRight, 'fill');
export const BarChart3 = wrap(PhChartBar, 'fill');
export const Bold = wrap(PhTextB, 'fill');
export const Book = wrap(PhBook, 'fill');
export const BookOpen = wrap(PhBookOpen, 'fill');
export const Bookmark = wrap(PhBookmark, 'regular');
export const BookmarkCheck = wrap(PhBookmark, 'fill');
export const Brain = wrap(PhBrain, 'fill');
export const Calendar = wrap(PhCalendar, 'fill');
export const Check = wrap(PhCheck, 'fill');
export const CheckCircle2 = wrap(PhCheckCircle, 'fill');
export const ChevronDown = wrap(PhCaretDown, 'fill');
export const Heart = wrap(PhHeart, 'fill');
export const Bell = wrap(PhBell, 'fill');
export const Briefcase = wrap(PhBriefcase, 'fill');
export const AlertTriangle = wrap(PhWarning, 'fill');
export const ChevronLeft = wrap(PhCaretLeft, 'fill');
export const ChevronRight = wrap(PhCaretRight, 'fill');
export const ClipboardList = wrap(PhClipboardText, 'fill');
export const Clock = wrap(PhClock, 'fill');
export const Cloud = wrap(PhCloud, 'fill');
export const Compass = wrap(PhCompass, 'fill');
export const Copy = wrap(PhCopy, 'fill');
export const Database = wrap(PhDatabase, 'fill');
export const Download = wrap(PhDownload, 'fill');
export const Eraser = wrap(PhEraser, 'fill');
export const FileIcon = wrap(PhFile, 'fill');
export const FileText = wrap(PhFileText, 'fill');
export const Filter = wrap(PhFunnel, 'fill');
export const Flag = wrap(PhFlag, 'fill');
export const Folder = wrap(PhFolder, 'fill');
export const FolderOpen = wrap(PhFolderOpen, 'fill');
export const FolderPlus = wrap(PhFolderPlus, 'fill');
export const GraduationCap = wrap(PhGraduationCap, 'fill');
export const HelpCircle = wrap(PhQuestion, 'fill');
export const Highlighter = wrap(PhHighlighter, 'fill');
export const Home = wrap(PhHouse, 'fill');
export const Image = wrap(PhImage, 'fill');
export const Info = wrap(PhInfo, 'fill');
export const Italic = wrap(PhTextItalic, 'fill');
export const Laptop = wrap(PhLaptop, 'fill');
export const Layers = wrap(PhStack, 'fill');
export const Loader2 = wrap(PhSpinnerGap, 'fill');
export const LogOut = wrap(PhSignOut, 'fill');
export const Maximize2 = wrap(PhArrowsOut, 'fill');
export const MessageSquarePlus = wrap(PhChatCircleText, 'fill');
export const Minimize2 = wrap(PhArrowsIn, 'fill');
export const Minus = wrap(PhMinus, 'fill');
export const Move = wrap(PhArrowsOutCardinal, 'fill');
export const Newspaper = wrap(PhNewspaper, 'fill');
export const Palette = wrap(PhPalette, 'fill');
export const PanelLeftClose = wrap(PhArrowLineLeft, 'fill');
export const PanelLeftOpen = wrap(PhArrowLineRight, 'fill');
export const Pause = wrap(PhPause, 'fill');
export const PenLine = wrap(PhNotePencil, 'fill');
export const Play = wrap(PhPlay, 'fill');
export const Plus = wrap(PhPlus, 'fill');
export const RotateCcw = wrap(PhArrowCounterClockwise, 'fill');
export const Save = wrap(PhFloppyDisk, 'fill');
export const Scale = wrap(PhScales, 'fill');
export const Scissors = wrap(PhScissors, 'fill');
export const Search = wrap(PhMagnifyingGlass, 'fill');
export const Settings = wrap(PhGear, 'fill');
export const Settings2 = wrap(PhGearSix, 'fill');
export const Share2 = wrap(PhShareNetwork, 'fill');
export const ShieldAlert = wrap(PhShieldWarning, 'fill');
export const Shirt = wrap(PhTShirt, 'fill');
export const Shuffle = wrap(PhShuffle, 'fill');
export const SkipForward = wrap(PhSkipForward, 'fill');
export const Smile = wrap(PhSmiley, 'fill');
export const Sparkles = wrap(PhSparkle, 'fill');
export const Target = wrap(PhTarget, 'fill');
export const Timer = wrap(PhTimer, 'fill');
export const Trash2 = wrap(PhTrash, 'fill');
export const TrendingUp = wrap(PhTrendUp, 'fill');
export const Trophy = wrap(PhTrophy, 'fill');
export const Type = wrap(PhTextT, 'fill');
export const Underline = wrap(PhTextUnderline, 'fill');
export const Undo2 = wrap(PhArrowUUpLeft, 'fill');
export const Redo2 = wrap(PhArrowUUpRight, 'fill');
export const UnfoldVertical = wrap(PhArrowsOutLineVertical, 'fill');
export const Upload = wrap(PhUpload, 'fill');
export const User = wrap(PhUser, 'fill');
export const UserRound = wrap(PhUserCircle, 'fill');
export const Users = wrap(PhUsers, 'fill');
export const Volume2 = wrap(PhSpeakerHigh, 'fill');
export const VolumeX = wrap(PhSpeakerX, 'fill');
export const X = wrap(PhX, 'fill');
export const XCircle = wrap(PhXCircle, 'fill');
export const Zap = wrap(PhLightning, 'fill');
export const Pencil = wrap(PhPencil, 'fill');
export const Brush = wrap(PhPaintBrush, 'fill');
export const Ruler = wrap(PhRuler, 'fill');
export const Square = wrap(PhSquare, 'fill');
export const Circle = wrap(PhCircle, 'fill');
export const MoreVertical = wrap(PhDotsThreeVertical, 'fill');
export const CheckSquare = wrap(PhCheckSquare, 'fill');
export const MousePointer = wrap(PhCursor, 'fill');
export const Pentagon = wrap(PhPentagon, 'fill');
export const Waypoints = wrap(PhPath, 'fill');
export const Moon = wrap(PhMoon, 'fill');
export const Sun = wrap(PhSun, 'fill');
