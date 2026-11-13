import "./site-footer.css";

export default function SiteFooter({ owner = "AeroSoft360" }: { owner?: string }) {
  return <footer className="site-footer">
    <span>© {new Date().getFullYear()} {owner}. All rights reserved.</span>
    <span>Developed by <a href="https://it.supuncompanies.com" target="_blank" rel="noopener noreferrer">Supun IT Solutions</a></span>
  </footer>;
}
