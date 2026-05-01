import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { changeLog } from "@/lib/schema";

export type ChangeKind =
  | "rename_node"
  | "update_summary"
  | "add_node"
  | "delete_node"
  | "move_node"
  | "append_content"
  | "replace_content"
  | "edit_content"
  | "insert_decoration"
  | "leave_suggestion"
  | "apply_suggestion"
  | "generate_outline"
  | "regenerate_outline"
  | "update_settings"
  | "update_status"
  | "kb_added"
  | "kb_removed";

export async function logChange(input: {
  projectId: string;
  actor: "user" | "ai";
  kind: ChangeKind;
  nodeId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(changeLog).values({
    id: nanoid(),
    projectId: input.projectId,
    actor: input.actor,
    kind: input.kind,
    nodeId: input.nodeId ?? null,
    description: input.description,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}
