import type { Resource } from "./resources";

export function ResourceCredit({ credit }: { credit: Resource["credit"] }) {
  return (
    <section
      className="resource-credit"
      aria-labelledby="resource-credit-heading"
    >
      <h2 id="resource-credit-heading">Credit</h2>
      <p>
        Credit to{" "}
        {credit.url ? (
          <a href={credit.url} target="_blank" rel="noopener noreferrer">
            {credit.name}
          </a>
        ) : (
          <span className="accent">{credit.name}</span>
        )}{" "}
        for {credit.contribution}.
        {credit.links?.map((link) => (
          <span key={link.url}>
            {" "}
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          </span>
        ))}
      </p>
    </section>
  );
}
