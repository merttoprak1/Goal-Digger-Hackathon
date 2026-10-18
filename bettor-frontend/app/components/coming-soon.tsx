/**
 * Placeholder for screens that exist in the wider design but are not built yet.
 * Keeps the app navigable while the screens are implemented.
 */
export function ComingSoon({
  title,
  description,
  planned,
}: {
  title: string;
  description: string;
  planned: string[];
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-14 lg:px-8">
      <div className="flex flex-col gap-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 md:p-12">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50 px-2.5 py-1 text-xs font-bold tracking-wider text-indigo-700 uppercase">
          Next up
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
            {description}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {planned.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm text-slate-600"
            >
              <span className="mt-0.5 text-indigo-500">◦</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
