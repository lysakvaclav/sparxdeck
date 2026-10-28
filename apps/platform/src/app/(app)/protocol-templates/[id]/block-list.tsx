"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DragHandleVerticalIcon,
  DuplicateIcon,
  EyeOffIcon,
  EyeOpenIcon,
  LockIcon,
  TrashIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { isLocked } from "@/lib/protocol-template/editor";
import type { TemplateBlock } from "@/lib/protocol-template/schema";
import { cn } from "@/lib/utils";

// The blocks of a protocol template, top to bottom (part 22, stage B): the
// selected block's properties show beside it. Blocks move by dragging, by
// keyboard (space picks one up, arrows move it, space puts it down; the
// steps are announced) and by the up and down buttons.

export type BlockActions = {
  select: (id: string) => void;
  move: (from: number, to: number) => void;
  shift: (id: string, step: -1 | 1) => void;
  toggleHidden: (id: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
};

function BlockRow({
  block,
  index,
  count,
  selected,
  name,
  issue,
  actions,
}: {
  block: TemplateBlock;
  index: number;
  count: number;
  selected: boolean;
  name: string;
  issue: boolean;
  actions: BlockActions;
}) {
  const t = useTranslations("protocolTemplates.blocks");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const locked = isLocked(block);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-block={block.id}
      className={cn(
        "relative flex items-stretch gap-0.5 rounded-lg bg-background shadow-[inset_0_0_0_1px_var(--border)]",
        selected && "shadow-[inset_0_0_0_2px_var(--ring)]",
        isDragging && "z-10 shadow-elevation-3",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t("drag", { name })}
        className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-s-lg text-muted-foreground outline-none hover:bg-accent focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] active:cursor-grabbing pointer-coarse:w-11"
      >
        <DragHandleVerticalIcon />
      </button>
      <button
        type="button"
        onClick={() => actions.select(block.id)}
        aria-current={selected ? "true" : undefined}
        data-select
        className="flex min-h-10 min-w-0 flex-1 items-center gap-2 py-1.5 text-start text-ui outline-none focus-visible:underline pointer-coarse:min-h-11"
      >
        <span className={cn("min-w-0 flex-1 truncate", block.hidden && "text-muted-foreground line-through")}>
          {name}
        </span>
        {locked && <LockIcon className="shrink-0 text-muted-foreground" aria-label={t("locked")} />}
        {block.hidden && <span className="shrink-0 text-ui-sm text-muted-foreground">{t("hidden")}</span>}
        {issue && (
          <span className="shrink-0 rounded-sm bg-destructive/15 px-1 text-ui-sm text-destructive-text">
            {t("issue")}
          </span>
        )}
      </button>
      {/* Only on the selected block: revealed on hover, they would move under the pointer. */}
      <div className={cn("flex shrink-0 items-center pe-0.5", !selected && "hidden")}>
        <Button variant="ghost" size="iconSm" aria-label={t("moveUp", { name })} disabled={index === 0} onClick={() => actions.shift(block.id, -1)}>
          <ArrowUpIcon />
        </Button>
        <Button variant="ghost" size="iconSm" aria-label={t("moveDown", { name })} disabled={index === count - 1} onClick={() => actions.shift(block.id, 1)}>
          <ArrowDownIcon />
        </Button>
        {!locked && (
          <>
            <Button
              variant="ghost"
              size="iconSm"
              aria-label={block.hidden ? t("show", { name }) : t("hide", { name })}
              aria-pressed={block.hidden ? true : false}
              onClick={() => actions.toggleHidden(block.id)}
            >
              {block.hidden ? <EyeOffIcon /> : <EyeOpenIcon />}
            </Button>
            <Button variant="ghost" size="iconSm" aria-label={t("duplicate", { name })} onClick={() => actions.duplicate(block.id)}>
              <DuplicateIcon />
            </Button>
            <Button variant="ghost" size="iconSm" aria-label={t("remove", { name })} onClick={() => actions.remove(block.id)}>
              <TrashIcon />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function BlockList({
  blocks,
  selected,
  names,
  issues,
  actions,
}: {
  blocks: TemplateBlock[];
  selected: string | null;
  /** The name of each block as the list shows it. */
  names: Record<string, string>;
  /** Blocks with something to fix. */
  issues: ReadonlySet<string>;
  actions: BlockActions;
}) {
  const t = useTranslations("protocolTemplates.blocks");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const position = (id: string | number) => blocks.findIndex((block) => block.id === id) + 1;
  const nameOf = (id: string | number) => names[String(id)] ?? String(id);
  const announcements: Announcements = {
    onDragStart: ({ active }) => t("dragStart", { name: nameOf(active.id), position: position(active.id), count: blocks.length }),
    onDragOver: ({ active, over }) =>
      over ? t("dragOver", { name: nameOf(active.id), position: position(over.id), count: blocks.length }) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t("dragEnd", { name: nameOf(active.id), position: position(over.id), count: blocks.length }) : t("dragCancel", { name: nameOf(active.id) }),
    onDragCancel: ({ active }) => t("dragCancel", { name: nameOf(active.id) }),
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    actions.move(position(active.id) - 1, position(over.id) - 1);
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t("dragInstructions") } }}
    >
      <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-1.5" aria-label={t("label")}>
          {blocks.map((block, index) => (
            <BlockRow
              key={block.id}
              block={block}
              index={index}
              count={blocks.length}
              selected={block.id === selected}
              name={names[block.id] ?? block.id}
              issue={issues.has(block.id)}
              actions={actions}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
