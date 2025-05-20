import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="layout-container">
      {/* You can add common layout elements here like Header, Footer, Sidebar */}
      <main>{children}</main>
    </div>
  );
};

export default Layout; 