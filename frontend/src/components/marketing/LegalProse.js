// Renders the structured JSON body used by Privacy + Terms pages. Each item
// in `body` is `{ heading, paragraphs?, list?, subgroups?, trailingParagraph? }`.
// Subgroups support the "What we collect / What we do NOT collect" two-up
// inside a single section.
//
// Body is read from i18n with returnObjects:true; if a translator hasn't
// localised the body for a given language, i18next falls back to en (the
// only locale that ships the long-form prose at this stage of the product).
export default function LegalProse({ body }) {
  if (!Array.isArray(body)) return null;
  return (
    <div className="flex flex-col gap-10 md:gap-12">
      {body.map((section, i) => (
        <Section key={i} section={section} />
      ))}
    </div>
  );
}

function Section({ section }) {
  if (!section) return null;
  return (
    <section className="text-start">
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground mb-3">
        {section.heading}
      </h2>

      {Array.isArray(section.paragraphs)
        && section.paragraphs.map((p, i) => (
          <p key={`p-${i}`} className="text-[15px] md:text-base leading-relaxed text-foreground/85 mb-3 last:mb-0">
            {p}
          </p>
        ))}

      {Array.isArray(section.list) && section.list.length > 0 && (
        <ul className="mt-2 mb-3 ms-5 flex flex-col gap-2 list-disc marker:text-primary/70">
          {section.list.map((item, i) => (
            <li key={`l-${i}`} className="text-[15px] md:text-base leading-relaxed text-foreground/85">
              {item}
            </li>
          ))}
        </ul>
      )}

      {Array.isArray(section.subgroups) && section.subgroups.length > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {section.subgroups.map((sub, i) => (
            <div
              key={`sg-${i}`}
              className="rounded-[18px] border border-sectionBorder bg-card p-5 shadow-[0_1px_8px_rgba(0,0,0,0.04)] dark:shadow-none"
            >
              <h3 className="text-[11px] font-semibold tracking-[0.16em] uppercase text-primary mb-3">
                {sub.subheading}
              </h3>
              {Array.isArray(sub.list) && (
                <ul className="ms-5 flex flex-col gap-2 list-disc marker:text-primary/70">
                  {sub.list.map((item, j) => (
                    <li key={`sgl-${j}`} className="text-sm md:text-[15px] leading-relaxed text-foreground/85">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {section.trailingParagraph && (
        <p className="mt-3 text-[15px] md:text-base leading-relaxed text-foreground/85">
          {section.trailingParagraph}
        </p>
      )}
    </section>
  );
}
