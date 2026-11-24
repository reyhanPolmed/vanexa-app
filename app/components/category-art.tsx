export function CategoryArt({ code }: { code: string }) {
  return <div aria-hidden="true" className={`category-art ${code.toLowerCase()}`}><span /><span /><span /><span /></div>;
}
