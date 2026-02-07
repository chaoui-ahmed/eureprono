import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Trophy, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";

const Layout = ({ children }: { children: ReactNode }) => {
  const { user, signOut, isModerator } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: "/", label: "Tips Feed", icon: Trophy },
    { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
    ...(isModerator ? [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <img src={logo} alt="EureProno" className="h-8 w-8 object-contain" />
            <span>EureProno</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link key={link.to} to={link.to}>
                <Button variant={isActive(link.to) ? "default" : "ghost"} size="sm" className="gap-2">
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            ) : (
              <Link to="/auth">
                <Button size="sm">Sign In</Button>
              </Link>
            )}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-border bg-card p-2 md:hidden">
            {links.map((link) => (
              <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}>
                <Button variant={isActive(link.to) ? "default" : "ghost"} className="w-full justify-start gap-2" size="sm">
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
};

export default Layout;
