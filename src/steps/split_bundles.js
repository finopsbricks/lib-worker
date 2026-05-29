import { defineStep } from '../define-step.js';
import { attachDocument, attachReport } from '../orchestrator.js';
import { bin } from '../workerPaths.js';
import { renderLocal } from '../renderLocal.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const TAG = '[split_bundles]';

export default defineStep({
  slug: 'lib-worker:split_bundles',
  name: 'Split PDF Bundle into Pages',
  description: 'Pick one unprocessed PDF bundle from input bin and split it into individual page PDFs using qpdf',

  inputSchema: z.object({
    station: z.string().describe('Station prefix, e.g. "HI1" or "HPO1". Derives bins: {station}_input, _output, _done, _failed'),
    report: z.boolean().default(false),
  }),
  outputSchema: z.object({
    bundle_name: z.string(),
    page_count: z.number(),
    status: z.enum(['split', 'no_pending_bundles']),
  }),

  execute: async (config, context) => {
    const { work_record } = context;
    const { station, report: as_report } = config;

    const attach = (content) => as_report
      ? attachReport(work_record.id, content)
      : attachDocument(work_record.id, 'Split Bundles', content, context.step.slug);

    const input_dir = bin(station, 'input');
    const output_dir = bin(station, 'output');
    const done_dir = bin(station, 'done');
    const failed_dir = bin(station, 'failed');

    fs.mkdirSync(input_dir, { recursive: true });
    fs.mkdirSync(output_dir, { recursive: true });

    // 1. Find all bundle PDFs
    const bundle_files = fs.readdirSync(input_dir)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .sort();

    if (bundle_files.length === 0) {
      console.log(`${TAG} No bundle PDFs found in ${station}_input`);
      const report = renderLocal(import.meta.url, './split_bundles_report.md', {
        status: 'no_pending_bundles', bundle_name: '', page_count: 0,
        bundles_remaining: 0, bundles_total: 0,
        station, work_record_id: work_record.id,
      });
      await attach(report);
      return { bundle_name: '', page_count: 0, status: 'no_pending_bundles' };
    }

    // 2. Find one unprocessed bundle
    //    A bundle is "unprocessed" if no {stem}/ directory exists in the output bin
    let target_bundle = null;
    let target_stem = null;

    for (const bundle_file of bundle_files) {
      const stem = bundle_file.replace(/\.pdf$/i, '');
      const bundle_dir = path.join(output_dir, stem);
      if (!fs.existsSync(bundle_dir)) {
        target_bundle = bundle_file;
        target_stem = stem;
        break;
      }
    }

    if (!target_bundle) {
      console.log(`${TAG} All bundles in ${station}_input already processed`);
      const report = renderLocal(import.meta.url, './split_bundles_report.md', {
        status: 'no_pending_bundles', bundle_name: '', page_count: 0,
        bundles_remaining: 0, bundles_total: bundle_files.length,
        station, work_record_id: work_record.id,
      });
      await attach(report);
      return { bundle_name: '', page_count: 0, status: 'no_pending_bundles' };
    }

    console.log(`${TAG} Processing bundle: ${target_bundle} (${station}_input)`);

    const bundle_path = path.join(input_dir, target_bundle);
    const pages_dir = path.join(output_dir, target_stem, '_pages');
    fs.mkdirSync(pages_dir, { recursive: true });

    try {
      // 3. Get page count via qpdf
      const info_output = execFileSync('qpdf', ['--show-npages', bundle_path], { encoding: 'utf8' });
      const total_pages = parseInt(info_output.trim(), 10);

      console.log(`${TAG} ${target_bundle}: ${total_pages} pages`);

      // 4. Split into individual page PDFs using qpdf
      for (let i = 1; i <= total_pages; i++) {
        const page_num = String(i).padStart(4, '0');
        const out_path = path.join(pages_dir, `page${page_num}.pdf`);

        execFileSync('qpdf', [bundle_path, '--pages', '.', `${i}`, '--', out_path]);

        if (i % 100 === 0) {
          console.log(`${TAG} ... ${i}/${total_pages} pages split`);
        }
      }

      // 5. Move processed bundle to done bin
      fs.mkdirSync(done_dir, { recursive: true });
      fs.renameSync(bundle_path, path.join(done_dir, target_bundle));

      console.log(`${TAG} ${target_bundle}: split into ${total_pages} page PDFs → ${station}_output/${target_stem}/_pages/`);

      const report = renderLocal(import.meta.url, './split_bundles_report.md', {
        status: 'split', bundle_name: target_bundle, page_count: total_pages,
        bundles_remaining: bundle_files.length - 1, bundles_total: bundle_files.length,
        station, stem: target_stem, work_record_id: work_record.id,
      });
      await attach(report);

      return { bundle_name: target_bundle, page_count: total_pages, status: 'split' };
    } catch (err) {
      // Move failed bundle to failed bin with companion .error file
      console.error(`${TAG} Failed to split ${target_bundle}: ${err.message}`);

      fs.mkdirSync(failed_dir, { recursive: true });
      fs.renameSync(bundle_path, path.join(failed_dir, target_bundle));
      fs.writeFileSync(
        path.join(failed_dir, `${target_stem}.error`),
        `${new Date().toISOString()}\n${err.message}\n${err.stack || ''}`,
      );

      // Clean up partial pages directory
      fs.rmSync(pages_dir, { recursive: true, force: true });

      throw err;
    }
  },
});
