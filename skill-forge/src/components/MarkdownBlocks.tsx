import type { Block } from '@/lib/markdown';

/**
 * Renders the block model produced by `lib/markdown` as React text nodes.
 *
 * It is a server component and it never sets HTML: the parser returns a typed
 * block list precisely so a skill published by anyone cannot inject markup.
 * Headings are shifted down one level (`h1` becomes `h2`), because the page
 * title is already the `h1`.
 */
export function MarkdownBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading': {
      const Tag = (`h${Math.min(block.level + 1, 6)}`) as 'h2';
      return <Tag className="font-display text-xl font-semibold text-[--ink]">{block.text}</Tag>;
    }
    case 'list':
      return block.ordered ? (
        <ol className="list-decimal space-y-1.5 pl-6">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-1.5 pl-6">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-xl bg-[oklch(20%_0.02_50)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[oklch(91%_0.03_70)]">
          <code>{block.text}</code>
        </pre>
      );
    default:
      return <p>{block.text}</p>;
  }
}
