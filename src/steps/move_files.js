import { defineStep } from '../define-step.js';
import { attachReport } from '../orchestrator.js';
import { moveFiles } from '../files.js';
import { bin } from '../workerPaths.js';
import { renderLocal } from '../renderLocal.js';
import { z } from 'zod';

/** Split "HI1/output" → ['HI1', 'output'] */
function parseBin(name) {
  return name.split('/');
}

const moveSchema = z.object({
  source_bin: z.string(),
  target_bin: z.string(),
  mode: z.enum(['files', 'directories']).default('files'),
  pattern: z.string().default('*'),
  batch_size: z.number().default(100),
});

export default defineStep({
  slug: 'lib-worker:move_files',
  name: 'Move Files Between Bins',
  description: 'Generic conveyor belt step — moves files or directories from one station bin to another',

  inputSchema: z.union([
    moveSchema,
    z.object({ moves: z.array(moveSchema).min(1) }),
  ]),
  outputSchema: z.object({
    moved_count: z.number(),
    total_available: z.number(),
    entries: z.array(z.string()),
  }),

  execute: async (config, context) => {
    const { work_record } = context;

    // Normalize: simple config → single-element moves array
    const moves = config.moves || [config];

    const moves_detail = [];
    let total_moved = 0;
    let total_available = 0;
    const all_entries = [];

    for (const move of moves) {
      const { source_bin, target_bin, mode, pattern, batch_size } = move;
      const [src_station, src_type] = parseBin(source_bin);
      const [tgt_station, tgt_type] = parseBin(target_bin);

      const result = moveFiles({
        source_dir: bin(src_station, src_type),
        target_dir: bin(tgt_station, tgt_type),
        mode, pattern, batch_size,
      });

      total_moved += result.moved_count;
      total_available += result.total_available;
      all_entries.push(...result.entries);

      moves_detail.push({
        source_bin, target_bin, mode,
        moved_count: result.moved_count,
        total_available: result.total_available,
        entries: result.entries,
      });
    }

    const report = renderLocal(import.meta.url, './move_files_report.md', {
      moves_detail, total_moved, total_available,
      work_record_id: work_record.id, timestamp: new Date().toISOString(),
    });
    await attachReport(work_record.id, report);

    return { moved_count: total_moved, total_available, entries: all_entries };
  },
});
