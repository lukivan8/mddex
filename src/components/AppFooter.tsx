import { DiscordIcon } from "./DiscordIcon";

export function AppFooter() {
  return (
    <footer className="shell footer">
      <div className="footer-brand">
        <img className="footer-logo" src="/mddex-logo.png" alt="MDDEX" />
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
        <a
          className="coffee-button"
          href="https://buymeacoffee.com/lukivan8"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Buy me a coffee (opens in a new tab)"
        >
          <img
            src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=&slug=lukivan8&button_colour=20282B&font_colour=D8DDE0&font_family=Cookie&outline_colour=C6AD65&coffee_colour=C6AD65"
            alt="Buy me a coffee"
            width="217"
            height="60"
            loading="lazy"
          />
        </a>
      </div>
    </footer>
  );
}
