import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-hidden">
        <Topbar />
        <main className="flex-1 p-4 md:p-6 overflow-auto w-full">
          <div className="page-enter w-full max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
