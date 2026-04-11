import { z } from "zod";

export const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().optional().nullable(),
  pinned: z.boolean().optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().optional().nullable(),
  pinned: z.boolean().optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export type Note = {
  id: string;
  title: string;
  body: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};
