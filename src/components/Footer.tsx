"use client"

import { useEffect, useState } from 'react';

// Define the exact shape of package.json we're using
interface PackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  // Add other fields as needed
}

export default function Footer() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    // Dynamically import package.json to get the version
    import('../../package.json')
      .then((pkg: { default: PackageJson }) => {
        setVersion(pkg.default.version);
      })
      .catch(() => {
        console.warn('Failed to load package.json');
      });
  }, []);

  return (
    <footer className="w-full h-4 py-1border-t border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>Version {version} TORPONG</p>
      </div>
    </footer>
  );
}
