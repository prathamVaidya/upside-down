import { z } from 'zod'

/**
 * A prompt has to survive two very different renderings: 19px on a phone during
 * the writing phase (mockup 2h) and 23px across a living room on the stage. 80
 * characters is where both stop working, so it is a hard ceiling rather than a
 * suggestion.
 */
export const PROMPT_MAX = 80

export const PromptSchema = z.object({
  id: z.string().regex(/^[a-z]{1,3}-\d{3}$/, 'ids look like g-001 or uk-014'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string().trim().min(8).max(PROMPT_MAX),
})

export const PromptFileSchema = z.object({
  region: z.enum(['global', 'in', 'uk', 'us']),
  prompts: z.array(PromptSchema).min(1),
})

export const FallbackFileSchema = z.object({
  fallbacks: z.array(z.string().trim().min(3).max(80)).min(4),
})

export const WordFileSchema = z.object({
  words: z
    .array(z.string().regex(/^[a-z]{4}$/, 'room-code words are four lowercase letters'))
    .min(20),
})

export type PromptRecord = z.infer<typeof PromptSchema>
