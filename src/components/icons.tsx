import type { ComponentType } from "react";
import type { IconProps, IconWeight } from "@phosphor-icons/react";
import {
  ArchiveIcon as PhArchive,
  ArrowClockwiseIcon as PhArrowClockwise,
  ArrowCounterClockwiseIcon as PhArrowCounterClockwise,
  ArrowDownIcon as PhArrowDown,
  ArrowLeftIcon as PhArrowLeft,
  ArrowRightIcon as PhArrowRight,
  ArrowUpIcon as PhArrowUp,
  ArrowUpRightIcon as PhArrowUpRight,
  ArrowsClockwiseIcon as PhArrowsClockwise,
  BookOpenIcon as PhBookOpen,
  BoxArrowUpIcon as PhBoxArrowUp,
  CalendarDotsIcon as PhCalendarDots,
  CameraIcon as PhCamera,
  CaretDownIcon as PhCaretDown,
  CaretRightIcon as PhCaretRight,
  CaretUpDownIcon as PhCaretUpDown,
  ChartBarIcon as PhChartBar,
  ChatCircleIcon as PhChatCircle,
  CheckIcon as PhCheck,
  CheckCircleIcon as PhCheckCircle,
  CircleNotchIcon as PhCircleNotch,
  ClockIcon as PhClock,
  ColumnsIcon as PhColumns,
  CopyIcon as PhCopy,
  DotsThreeIcon as PhDotsThree,
  DownloadSimpleIcon as PhDownloadSimple,
  EyeIcon as PhEye,
  EyeSlashIcon as PhEyeSlash,
  FileArrowUpIcon as PhFileArrowUp,
  FileAudioIcon as PhFileAudio,
  FileCsvIcon as PhFileCsv,
  FileTextIcon as PhFileText,
  FilmStripIcon as PhFilmStrip,
  GearSixIcon as PhGearSix,
  HouseIcon as PhHouse,
  KeyIcon as PhKey,
  ListIcon as PhList,
  MagnifyingGlassIcon as PhMagnifyingGlass,
  MagnifyingGlassMinusIcon as PhMagnifyingGlassMinus,
  MicrophoneIcon as PhMicrophone,
  MonitorIcon as PhMonitor,
  MoonIcon as PhMoon,
  NotePencilIcon as PhNotePencil,
  PaperclipIcon as PhPaperclip,
  PencilSimpleIcon as PhPencilSimple,
  PlugIcon as PhPlug,
  PlugsIcon as PhPlugs,
  PlusIcon as PhPlus,
  ProhibitIcon as PhProhibit,
  SidebarSimpleIcon as PhSidebarSimple,
  SignInIcon as PhSignIn,
  SignOutIcon as PhSignOut,
  SlidersHorizontalIcon as PhSlidersHorizontal,
  SquareIcon as PhSquare,
  StackIcon as PhStack,
  SunIcon as PhSun,
  TrashIcon as PhTrash,
  UploadSimpleIcon as PhUploadSimple,
  UserCircleIcon as PhUserCircle,
  UserPlusIcon as PhUserPlus,
  VideoCameraIcon as PhVideoCamera,
  WarningIcon as PhWarning,
  WarningCircleIcon as PhWarningCircle,
  WebhooksLogoIcon as PhWebhooksLogo,
  XIcon as PhX,
  SparkleIcon as PhSparkle,
  StorefrontIcon as PhStorefront,
  ShieldWarningIcon as PhShieldWarning,
  ClockCounterClockwiseIcon as PhClockCounterClockwise,
} from "@phosphor-icons/react/ssr";

/**
 * App icon set: Phosphor duotone for objects and places, bold for small
 * controls (arrows, carets, close). Names mirror the previous Lucide set so
 * call sites read the same. The ssr build works in server and client components.
 */
export type AppIcon = ComponentType<IconProps>;
/** Kept for existing type annotations. */
export type LucideIcon = AppIcon;
export type { IconWeight };

function icon(Phosphor: AppIcon, defaultWeight: IconWeight): AppIcon {
  function AppIconComponent({ weight = defaultWeight, size = 24, ...props }: IconProps) {
    return <Phosphor weight={weight} size={size} {...props} />;
  }
  return AppIconComponent;
}

export const Archive = icon(PhArchive, "duotone");
export const ArchiveRestore = icon(PhBoxArrowUp, "duotone");
export const ArrowDown = icon(PhArrowDown, "bold");
export const ArrowLeft = icon(PhArrowLeft, "bold");
export const ArrowRight = icon(PhArrowRight, "bold");
export const ArrowUp = icon(PhArrowUp, "bold");
export const ArrowUpRight = icon(PhArrowUpRight, "bold");
export const Ban = icon(PhProhibit, "duotone");
export const BookOpen = icon(PhBookOpen, "duotone");
export const CalendarDays = icon(PhCalendarDots, "duotone");
export const Camera = icon(PhCamera, "duotone");
export const ChartColumn = icon(PhChartBar, "duotone");
export const Check = icon(PhCheck, "bold");
export const CheckCircle2 = icon(PhCheckCircle, "duotone");
export const CheckIcon = icon(PhCheck, "bold");
export const ChevronDown = icon(PhCaretDown, "bold");
export const ChevronDownIcon = icon(PhCaretDown, "bold");
export const ChevronRightIcon = icon(PhCaretRight, "bold");
export const ChevronsUpDown = icon(PhCaretUpDown, "bold");
export const CircleAlert = icon(PhWarningCircle, "duotone");
export const Clock = icon(PhClock, "duotone");
export const Columns3 = icon(PhColumns, "duotone");
export const Copy = icon(PhCopy, "duotone");
export const Download = icon(PhDownloadSimple, "bold");
export const Ellipsis = icon(PhDotsThree, "bold");
export const Eye = icon(PhEye, "duotone");
export const EyeOff = icon(PhEyeSlash, "duotone");
export const FileAudio = icon(PhFileAudio, "duotone");
export const FileSpreadsheet = icon(PhFileCsv, "duotone");
export const FileText = icon(PhFileText, "duotone");
export const FileUp = icon(PhFileArrowUp, "duotone");
export const Film = icon(PhFilmStrip, "duotone");
export const House = icon(PhHouse, "duotone");
export const KeyRound = icon(PhKey, "duotone");
export const Layers = icon(PhStack, "duotone");
export const Loader2 = icon(PhCircleNotch, "bold");
export const LoaderCircle = icon(PhCircleNotch, "bold");
export const LogIn = icon(PhSignIn, "duotone");
export const LogOut = icon(PhSignOut, "duotone");
export const Menu = icon(PhList, "bold");
export const MessageSquare = icon(PhChatCircle, "duotone");
export const Mic = icon(PhMicrophone, "duotone");
export const Monitor = icon(PhMonitor, "duotone");
export const Moon = icon(PhMoon, "duotone");
export const PanelLeftClose = icon(PhSidebarSimple, "duotone");
export const PanelLeftOpen = icon(PhSidebarSimple, "duotone");
export const Paperclip = icon(PhPaperclip, "bold");
export const Pencil = icon(PhPencilSimple, "duotone");
export const Plug = icon(PhPlug, "duotone");
export const Plus = icon(PhPlus, "bold");
export const RefreshCw = icon(PhArrowsClockwise, "bold");
export const RotateCcw = icon(PhArrowCounterClockwise, "bold");
export const RotateCw = icon(PhArrowClockwise, "bold");
export const Search = icon(PhMagnifyingGlass, "duotone");
export const SearchX = icon(PhMagnifyingGlassMinus, "duotone");
export const Settings = icon(PhGearSix, "duotone");
export const Settings2 = icon(PhSlidersHorizontal, "duotone");
export const Square = icon(PhSquare, "fill");
export const SquarePen = icon(PhNotePencil, "duotone");
export const Sun = icon(PhSun, "duotone");
export const Trash2 = icon(PhTrash, "duotone");
export const TriangleAlert = icon(PhWarning, "duotone");
export const Unplug = icon(PhPlugs, "duotone");
export const Upload = icon(PhUploadSimple, "bold");
export const UserPlus = icon(PhUserPlus, "duotone");
export const UserRound = icon(PhUserCircle, "duotone");
export const Video = icon(PhVideoCamera, "duotone");
export const Webhook = icon(PhWebhooksLogo, "duotone");
export const X = icon(PhX, "bold");
export const XIcon = icon(PhX, "bold");
export const Storefront = icon(PhStorefront, "duotone");
export const Sparkle = icon(PhSparkle, "duotone");
export const ShieldWarning = icon(PhShieldWarning, "duotone");
export const History = icon(PhClockCounterClockwise, "duotone");
