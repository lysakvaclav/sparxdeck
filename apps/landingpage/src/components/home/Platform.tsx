/** A section's heading: the title on one side, the text (and a link) on the other. */
export function SectionHeading({
  title,
  body,
  id,
  children,
}: {
  title: string;
  body?: string;
  id: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:gap-20">
      <h2 id={id} className="text-4xl leading-[1.05] md:text-5xl lg:text-[3.5rem]">
        {title}
      </h2>
      {(body || children) && (
        <div className="lg:pt-2">
          {body && <p className="text-lg leading-snug text-main md:text-[1.4rem] md:leading-[1.35]">{body}</p>}
          {children}
        </div>
      )}
    </div>
  );
}
