import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Render AI text as proper Markdown (bold/headings/lists), styled with our tokens.
// GitHub task lists (- [ ] item) become real, tickable checkboxes.
const components = {
  h1: ({ node, ...p }) => <h3 className="text-headline-md font-bold text-on-surface mt-3 mb-2 first:mt-0" {...p} />,
  h2: ({ node, ...p }) => <h4 className="font-bold text-on-surface mt-3 mb-1.5 first:mt-0" {...p} />,
  h3: ({ node, ...p }) => <h4 className="font-bold text-on-surface mt-2 mb-1 first:mt-0" {...p} />,
  p: ({ node, ...p }) => <p className="mb-2 last:mb-0 leading-relaxed" {...p} />,
  ul: ({ node, ...p }) => <ul className="list-disc pl-5 mb-2 space-y-1 marker:text-on-surface-variant" {...p} />,
  ol: ({ node, ...p }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...p} />,
  li: ({ node, className, ...p }) => (
    <li
      className={
        className?.includes("task-list-item")
          ? "list-none -ml-5 flex items-start gap-2"
          : ""
      }
      {...p}
    />
  ),
  strong: ({ node, ...p }) => <strong className="font-bold text-on-surface" {...p} />,
  em: ({ node, ...p }) => <em className="italic" {...p} />,
  a: ({ node, ...p }) => <a className="text-primary underline" target="_blank" rel="noreferrer" {...p} />,
  blockquote: ({ node, ...p }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-on-surface-variant" {...p} />
  ),
  pre: ({ node, ...p }) => (
    <pre className="bg-surface-container-lowest p-3 rounded-lg overflow-x-auto mb-2 text-label-md" {...p} />
  ),
  code: ({ node, ...p }) => (
    <code className="bg-surface-container-high px-1 py-0.5 rounded text-[0.9em]" {...p} />
  ),
  hr: () => <hr className="border-outline-variant/30 my-3" />,
  input({ node, type, checked, disabled, ...rest }) {
    if (type === "checkbox") {
      // Enabled (not disabled) so the user can actually tick it.
      return (
        <input
          type="checkbox"
          defaultChecked={!!checked}
          className="mt-1 w-4 h-4 rounded accent-primary shrink-0 cursor-pointer"
        />
      );
    }
    return <input type={type} {...rest} />;
  },
};

export default function Markdown({ children, className = "" }) {
  return (
    <div className={`text-body-md text-on-surface ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children || ""}
      </ReactMarkdown>
    </div>
  );
}
