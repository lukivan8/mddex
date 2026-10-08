import { DiscordIcon } from "./DiscordIcon";
import { CoffeeButton } from "./CoffeeButton";

export function AppFooter() {
  return (
    <footer className="shell footer">
      <div className="footer-brand">
        <img
          className="footer-logo"
          src="/mddex-logo.webp"
          srcSet="/mddex-logo.webp 1x, /mddex-logo@2x.webp 2x"
          width={48}
          height={48}
          alt="MDDEX"
        />
        <p>
          Independent fan-made tool.
          <br />
          Not affiliated with Mojang or Microsoft.
        </p>
      </div>
      <div className="footer-contact-actions">
        <span className="footer-discord" title="Contact on Discord">
          <DiscordIcon size={18} />
          <span className="sr-only">Discord: </span>
          lukivan8
        </span>
        <CoffeeButton />
      </div>
    </footer>
  );
}
