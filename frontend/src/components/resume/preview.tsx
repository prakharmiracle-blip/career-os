"use client";

import { useEffect, useRef, useState } from "react";

import type { ResumeData, Template } from "@/lib/resume";
import { cn } from "@/lib/utils";

const A4_W = 794; // px at 96 dpi
const A4_H = 1123;

const STYLES: Record<Template, { font: string; accent: string; center: boolean; rule: boolean; nameColor: string }> = {
  modern: { font: "font-sans", accent: "#5B4BD6", center: false, rule: true, nameColor: "#5B4BD6" },
  professional: { font: "font-serif", accent: "#16183A", center: true, rule: true, nameColor: "#16183A" },
  minimal: { font: "font-sans", accent: "#16183A", center: false, rule: false, nameColor: "#16183A" },
};

const dates = (a: string, b: string) => [a, b].filter((x) => x.trim()).join(" – ");

/**
 * On-screen rendering of the resume. Mirrors the PDF/DOCX export (single column,
 * same sections and order), so what you see is what downloads.
 */
export function ResumePage({ data, template }: { data: ResumeData; template: Template }) {
  const s = STYLES[template];
  const b = data.basics;
  const contact = [b.email, b.phone, b.location, b.linkedin, b.website].filter((x) => x.trim());
  const H = ({ children }: { children: string }) => (
    <h3
      className={cn("mb-1.5 mt-4 pb-0.5 text-[13px] font-bold", template !== "minimal" && "uppercase tracking-wide")}
      style={{ color: s.accent, borderBottom: s.rule ? `1px solid ${s.accent}` : undefined }}
    >
      {children}
    </h3>
  );
  const Row = ({ left, right }: { left: string; right: string }) => (
    <div className="flex items-baseline justify-between gap-4">
      <p className="text-[12.5px] font-bold text-[#16183A]">{left}</p>
      {right && <p className="shrink-0 text-[11.5px] text-[#4B4F72]">{right}</p>}
    </div>
  );
  const Bullets = ({ items }: { items: string[] }) => (
    <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[12px] leading-[1.45] text-[#16183A]">
      {items.filter((x) => x.trim()).map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );

  return (
    <div className={cn("bg-white px-[60px] py-[52px] text-[#16183A]", s.font)} style={{ width: A4_W, minHeight: A4_H }}>
      <header className={cn(s.center && "text-center")}>
        <h2 className="text-[26px] font-bold leading-tight" style={{ color: s.nameColor }}>
          {b.name || "Your Name"}
        </h2>
        {b.title && <p className="mt-0.5 text-[14px] text-[#4B4F72]">{b.title}</p>}
        {contact.length > 0 && <p className="mt-1.5 text-[11.5px] text-[#4B4F72]">{contact.join("  |  ")}</p>}
      </header>
      {b.summary.trim() && (
        <>
          <H>Summary</H>
          <p className="text-[12px] leading-[1.5]">{b.summary}</p>
        </>
      )}
      {data.experience.length > 0 && (
        <>
          <H>Experience</H>
          <div className="space-y-2.5">
            {data.experience.map((x, i) => (
              <div key={i}>
                <Row left={[x.role, x.company].filter(Boolean).join(" — ")} right={dates(x.start, x.end)} />
                {x.location && <p className="text-[11.5px] text-[#4B4F72]">{x.location}</p>}
                <Bullets items={x.bullets} />
              </div>
            ))}
          </div>
        </>
      )}
      {data.projects.length > 0 && (
        <>
          <H>Projects</H>
          <div className="space-y-2.5">
            {data.projects.map((p, i) => (
              <div key={i}>
                <Row left={p.name} right={p.link} />
                <Bullets items={p.bullets} />
              </div>
            ))}
          </div>
        </>
      )}
      {data.education.length > 0 && (
        <>
          <H>Education</H>
          <div className="space-y-1.5">
            {data.education.map((e, i) => (
              <div key={i}>
                <Row left={[e.degree, e.school].filter(Boolean).join(", ")} right={dates(e.start, e.end)} />
                {e.score && <p className="text-[11.5px] text-[#4B4F72]">{e.score}</p>}
              </div>
            ))}
          </div>
        </>
      )}
      {data.skills.length > 0 && (
        <>
          <H>Skills</H>
          <p className="text-[12px] leading-[1.5]">{data.skills.join(", ")}</p>
        </>
      )}
      {data.certifications.filter((c) => c.trim()).length > 0 && (
        <>
          <H>Certifications</H>
          <Bullets items={data.certifications} />
        </>
      )}
    </div>
  );
}

/** Scales the A4 page to fit its container width. */
export function ScaledPreview({ data, template, className }: { data: ResumeData; template: Template; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(A4_H);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(el.clientWidth / A4_W);
      setHeight(page.current?.offsetHeight ?? A4_H);
    });
    ro.observe(el);
    if (page.current) ro.observe(page.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className={cn("overflow-hidden rounded-xl border border-line bg-white shadow-card", className)} style={{ height: height * scale }}>
      <div ref={page} style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: A4_W }} aria-label="Resume preview">
        <ResumePage data={data} template={template} />
      </div>
    </div>
  );
}
