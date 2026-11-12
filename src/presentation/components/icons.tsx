/**
 * The app's single icon module (Phosphor Icons, MIT, https://phosphoricons.com).
 *
 * Export names keep the vocabulary the codebase already used, so call sites read
 * the same; every icon defaults to the `duotone` weight (pure glyphs such as
 * carets, X and check use `bold` so they stay crisp at 16px). Pass `weight` to
 * override per use. Imported from `dist/ssr` so they render in Server and Client
 * Components alike (no React context needed).
 *
 * Large, decorative "hero" spots use the Fluent 3D <Illustration> instead.
 */
import type { ComponentType } from "react";
import type { Icon, IconProps, IconWeight } from "@phosphor-icons/react";
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  CalendarCheckIcon,
  CalendarDotsIcon,
  CameraIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpIcon,
  ChartBarIcon,
  ChatCircleTextIcon,
  ChatTeardropTextIcon,
  ChatTextIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleIcon,
  CircleNotchIcon,
  ClockCounterClockwiseIcon,
  ClockIcon,
  ConfettiIcon,
  DatabaseIcon,
  DiamondIcon,
  DotsThreeVerticalIcon,
  DownloadSimpleIcon,
  EyeIcon,
  EyeSlashIcon,
  FileTextIcon,
  HandCoinsIcon,
  HouseIcon,
  ImageBrokenIcon,
  ImageSquareIcon,
  InfoIcon as PhInfoIcon,
  ListIcon,
  ListPlusIcon,
  MagnifyingGlassIcon,
  MoneyIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  PencilSimpleIcon,
  PhoneIcon,
  PlusIcon,
  PrinterIcon,
  ProhibitIcon,
  ReceiptIcon,
  ScalesIcon,
  ShapesIcon,
  ShieldCheckIcon,
  SignOutIcon,
  SlidersHorizontalIcon,
  StorefrontIcon,
  SunIcon,
  TranslateIcon,
  TrashIcon,
  TrendUpIcon,
  UserCircleIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
  WarningIcon,
  WarningOctagonIcon,
  XCircleIcon,
  XIcon as PhXIcon,
} from "@phosphor-icons/react/dist/ssr";

export type { IconProps } from "@phosphor-icons/react";
/** Any icon from this module. */
export type AppIcon = ComponentType<IconProps>;

function withWeight(Base: Icon, weight: IconWeight, name: string): AppIcon {
  function AppIconComponent(props: IconProps) {
    return <Base weight={weight} {...props} />;
  }
  AppIconComponent.displayName = name;
  return AppIconComponent;
}

const duo = (Base: Icon, name: string) => withWeight(Base, "duotone", name);
const bold = (Base: Icon, name: string) => withWeight(Base, "bold", name);

// ── Glyphs: no fill area, so bold for crispness ──────────────────────────────
export const ArrowLeft = bold(ArrowLeftIcon, "ArrowLeft");
export const Check = bold(CheckIcon, "Check");
export const ChevronDown = bold(CaretDownIcon, "ChevronDown");
export const ChevronLeft = bold(CaretLeftIcon, "ChevronLeft");
export const ChevronRight = bold(CaretRightIcon, "ChevronRight");
export const ChevronUp = bold(CaretUpIcon, "ChevronUp");
export const Loader2 = bold(CircleNotchIcon, "Loader2");
export const Menu = bold(ListIcon, "Menu");
export const MoreVertical = bold(DotsThreeVerticalIcon, "MoreVertical");
export const Plus = bold(PlusIcon, "Plus");
export const RotateCcw = bold(ArrowCounterClockwiseIcon, "RotateCcw");
export const X = bold(PhXIcon, "X");
/** Solid dot (radio / menu indicator). */
export const Circle = withWeight(CircleIcon, "fill", "Circle");

// ── Pictograms: duotone ──────────────────────────────────────────────────────
export const AlertTriangle = duo(WarningIcon, "AlertTriangle");
export const Archive = duo(ArchiveIcon, "Archive");
export const ArchiveRestore = duo(ArrowCounterClockwiseIcon, "ArchiveRestore");
export const Ban = duo(ProhibitIcon, "Ban");
export const Banknote = duo(MoneyIcon, "Banknote");
export const BarChart3 = duo(ChartBarIcon, "BarChart3");
export const CalendarCheck = duo(CalendarCheckIcon, "CalendarCheck");
export const CalendarClock = duo(CalendarDotsIcon, "CalendarClock");
export const Camera = duo(CameraIcon, "Camera");
export const CheckCircle2 = duo(CheckCircleIcon, "CheckCircle2");
export const CircleCheck = CheckCircle2;
export const Clock = duo(ClockIcon, "Clock");
export const Database = duo(DatabaseIcon, "Database");
export const Download = duo(DownloadSimpleIcon, "Download");
export const Eye = duo(EyeIcon, "Eye");
export const EyeOff = duo(EyeSlashIcon, "EyeOff");
export const FileBarChart = duo(ChartBarIcon, "FileBarChart");
export const FileText = duo(FileTextIcon, "FileText");
export const Gem = duo(DiamondIcon, "Gem");
export const HandCoins = duo(HandCoinsIcon, "HandCoins");
export const History = duo(ClockCounterClockwiseIcon, "History");
export const Home = duo(HouseIcon, "Home");
export const ImageOff = duo(ImageBrokenIcon, "ImageOff");
export const ImagePlus = duo(ImageSquareIcon, "ImagePlus");
export const Info = duo(PhInfoIcon, "Info");
export const Languages = duo(TranslateIcon, "Languages");
export const ListPlus = duo(ListPlusIcon, "ListPlus");
export const LogOut = duo(SignOutIcon, "LogOut");
export const MessageCircle = duo(ChatCircleTextIcon, "MessageCircle");
export const MessageSquare = duo(ChatTextIcon, "MessageSquare");
export const MessageSquarePlus = duo(ChatTeardropTextIcon, "MessageSquarePlus");
export const Monitor = duo(MonitorIcon, "Monitor");
export const Moon = duo(MoonIcon, "Moon");
export const OctagonX = duo(WarningOctagonIcon, "OctagonX");
export const Palette = duo(PaletteIcon, "Palette");
export const PartyPopper = duo(ConfettiIcon, "PartyPopper");
export const Pencil = duo(PencilSimpleIcon, "Pencil");
export const Phone = duo(PhoneIcon, "Phone");
export const Printer = duo(PrinterIcon, "Printer");
export const ReceiptText = duo(ReceiptIcon, "ReceiptText");
export const Scale = duo(ScalesIcon, "Scale");
export const Search = duo(MagnifyingGlassIcon, "Search");
export const Shapes = duo(ShapesIcon, "Shapes");
export const ShieldCheck = duo(ShieldCheckIcon, "ShieldCheck");
export const SlidersHorizontal = duo(SlidersHorizontalIcon, "SlidersHorizontal");
export const Store = duo(StorefrontIcon, "Store");
export const Sun = duo(SunIcon, "Sun");
export const Trash2 = duo(TrashIcon, "Trash2");
export const TrendingUp = duo(TrendUpIcon, "TrendingUp");
export const User = duo(UserIcon, "User");
export const UserPlus = duo(UserPlusIcon, "UserPlus");
export const UserRound = duo(UserCircleIcon, "UserRound");
export const Users = duo(UsersIcon, "Users");
export const Wallet = duo(WalletIcon, "Wallet");
export const XCircle = duo(XCircleIcon, "XCircle");
