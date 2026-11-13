"use client";

// Edit mode for the dashboard (spec, phase 6). Blocks can be dragged by their
// handle on laptops (dnd-kit; mouse and keyboard only, since dragging inside a
// scrolling page is fiddly on touch screens), moved with the up/down buttons
// anywhere, and hidden. Hidden blocks wait in a tray at the bottom. Needs
// attention isn't part of this: it can't be moved or hidden.

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical } from "lucide-react";
import { Card } from "@/components/admin/ui/card";
import { blockLabel, type BlockId, type DashboardLayout } from "@/lib/admin/dashboard-model";
import { cn } from "@/lib/utils";


const iconBtn =
  "inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:size-8";

export function EditableGrid({
  layout,
  visible,
  spanOf,
  render,
  onChange,
}: {
  layout: DashboardLayout;
  /** Blocks shown in this setup, in layout order, hidden ones left out. */
  visible: BlockId[];
  spanOf: (id: BlockId) => string;
  render: (id: BlockId) => React.ReactNode;
  onChange: (next: DashboardLayout) => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Moves only reorder the visible blocks; hidden ones keep their place in the
  // full order, so showing one again puts it back where it was.
  const reorder = (nextVisible: BlockId[]) => {
    const slots = layout.order.map((id) => visible.includes(id));
    let i = 0;
    onChange({ ...layout, order: layout.order.map((id, k) => (slots[k] ? nextVisible[i++] : id)) });
  };
  const move = (id: BlockId, by: -1 | 1) => {
    const from = visible.indexOf(id);
    const to = from + by;
    if (to < 0 || to >= visible.length) return;
    reorder(arrayMove(visible, from, to));
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    reorder(arrayMove(visible, visible.indexOf(active.id as BlockId), visible.indexOf(over.id as BlockId)));
  };
  const hide = (id: BlockId) => onChange({ ...layout, hidden: [...layout.hidden, id] });

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={visible} strategy={rectSortingStrategy}>
        {/* No dense packing while editing, so what you see is the real order. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
          {visible.map((id, i) => (
            <SortableBlock
              key={id}
              id={id}
              className={spanOf(id)}
              first={i === 0}
              last={i === visible.length - 1}
              onUp={() => move(id, -1)}
              onDown={() => move(id, 1)}
              onHide={() => hide(id)}
            >
              {render(id)}
            </SortableBlock>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableBlock({
  id,
  className,
  first,
  last,
  onUp,
  onDown,
  onHide,
  children,
}: {
  id: BlockId;
  className: string;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onHide: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const name = blockLabel(id);
  return (
    <section
      ref={setNodeRef}
      aria-label={name}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative min-w-0 rounded-xl outline-2 outline-offset-2 outline-dashed outline-primary/40",
        isDragging && "z-20 opacity-80 shadow-lg outline-primary",
        className,
      )}
    >
      {/* The block itself can't be clicked while editing. */}
      <div inert className="h-full select-none">
        {children}
      </div>
      <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-lg border bg-card/95 p-0.5 shadow-sm backdrop-blur">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className={cn(iconBtn, "hidden cursor-grab touch-none active:cursor-grabbing md:inline-flex")}
          aria-label={`Drag ${name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <button type="button" className={iconBtn} onClick={onUp} disabled={first} aria-label={`Move ${name} up`}>
          <ArrowUp className="size-4" aria-hidden />
        </button>
        <button type="button" className={iconBtn} onClick={onDown} disabled={last} aria-label={`Move ${name} down`}>
          <ArrowDown className="size-4" aria-hidden />
        </button>
        <button type="button" className={iconBtn} onClick={onHide} aria-label={`Hide ${name}`}>
          <EyeOff className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}

/** Hidden blocks, waiting to be shown again. Shown while editing. */
export function HiddenTray({ hidden, onShow }: { hidden: BlockId[]; onShow: (id: BlockId) => void }) {
  return (
    <Card className="border-dashed p-3">
      <h2 className="px-1 pb-2 text-sm font-semibold">
        Hidden blocks <span className="font-normal text-muted-foreground">({hidden.length})</span>
      </h2>
      {hidden.length === 0 ? (
        <p className="px-1 pb-1 text-sm text-muted-foreground">Nothing hidden.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {hidden.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onShow(id)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-3 text-sm hover:border-primary/40 sm:min-h-9"
              >
                <Eye className="size-4 text-primary" aria-hidden />
                <span>Show {blockLabel(id)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
