import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  MinusSignIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Tick02Icon,
  Calendar03Icon,
  UndoIcon,
  RedoIcon,
  TextIcon,
  Heading01Icon,
  ParagraphIcon,
  TextCircleIcon,
  SquareIcon as Square01Icon,
  RectangularIcon,
  CircleIcon,
  Image01Icon,
  Layers01Icon,
  ViewIcon,
  ViewOffIcon,
  LockIcon,
  LockOpenIcon,
  Menu01Icon,
  LineIcon,
  SplineIcon as DrawingCompassIcon,
  Sun01Icon,
  Moon01Icon,
  Maximize01Icon,
  Minimize01Icon,
  ImageDownloadIcon,
} from "@hugeicons/core-free-icons";

const icons = {
  add: Add01Icon,
  minus: MinusSignIcon,
  down: ArrowDown01Icon,
  up: ArrowUp01Icon,
  left: ArrowLeft01Icon,
  right: ArrowRight01Icon,
  check: Tick02Icon,
  calendar: Calendar03Icon,
  undo: UndoIcon,
  redo: RedoIcon,
  text: TextIcon,
  heading: Heading01Icon,
  paragraph: ParagraphIcon,
  arc: TextCircleIcon,
  box: Square01Icon,
  rounded: RectangularIcon,
  circle: CircleIcon,
  image: Image01Icon,
  layers: Layers01Icon,
  view: ViewIcon,
  hidden: ViewOffIcon,
  lock: LockIcon,
  unlock: LockOpenIcon,
  menu: Menu01Icon,
  line: LineIcon,
  curve: DrawingCompassIcon,
  sun: Sun01Icon,
  moon: Moon01Icon,
  maximize: Maximize01Icon,
  minimize: Minimize01Icon,
  export: ImageDownloadIcon,
};
export type IconName = keyof typeof icons;
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <HugeiconsIcon
      icon={icons[name]}
      size={size}
      strokeWidth={1.7}
      aria-hidden="true"
      className="ui-icon"
    />
  );
}
