import katex from "katex";
export function Formula({ value }: { value: string }) {
  return (
    <div
      className="formula"
      role="math"
      aria-label={value}
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(value, {
          throwOnError: false,
          output: "htmlAndMathml",
        }),
      }}
    />
  );
}
