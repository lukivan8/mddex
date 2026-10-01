import { CatalogNavigationLink } from "../../components/CatalogNavigationLink";
import type { CatalogIndexGroup } from "./catalog-index";
import "./catalog-directory.css";

export function CatalogDirectory({
  groups,
  title = "All equipment",
  description = "Browse every published item by category.",
}: {
  groups: CatalogIndexGroup[];
  title?: string;
  description?: string;
}) {
  return (
    <nav className="catalog-directory" aria-label={`${title} pages`}>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="catalog-directory-groups">
        {groups.map((group) => (
          <details key={group.category}>
            <summary>
              {group.label} <span>{group.items.length}</span>
            </summary>
            <ul>
              {group.items.map((item) => (
                <li key={item.path}>
                  <CatalogNavigationLink href={item.path}>
                    {item.name}
                  </CatalogNavigationLink>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </nav>
  );
}
