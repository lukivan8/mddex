export function AppFooter() {
  return (
    <footer className="shell footer">
      <img className="footer-logo" src="/mddex-logo.png" alt="MDDEX" />
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
    </footer>
  );
}
