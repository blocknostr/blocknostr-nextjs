import * as React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode, className?: string }) {
    return <div className={`bg-white dark:bg-gray-900 rounded-lg shadow p-6 ${className}`}>{children}</div>;
}
export function CardHeader({ children }: { children: React.ReactNode }) {
    return <div className="mb-4">{children}</div>;
}
export function CardTitle({ children, className = "" }: { children: React.ReactNode, className?: string }) {
    return <h2 className={`text-xl font-bold ${className}`}>{children}</h2>;
}
export function CardDescription({ children }: { children: React.ReactNode }) {
    return <p className="text-gray-500 dark:text-gray-400 text-sm">{children}</p>;
}
export function CardContent({ children, className = "" }: { children: React.ReactNode, className?: string }) {
    return <div className={className}>{children}</div>;
}
export function CardFooter({ children, className = "" }: { children: React.ReactNode, className?: string }) {
    return <div className={className}>{children}</div>;
}
