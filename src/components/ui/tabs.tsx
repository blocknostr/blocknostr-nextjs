import * as React from "react";

export function Tabs({ defaultValue, onValueChange, children }: { defaultValue: string, onValueChange?: (val: string) => void, children: React.ReactNode }) {
    const [value, setValue] = React.useState(defaultValue);
    React.useEffect(() => { if (onValueChange) onValueChange(value); }, [value]);

    return (
        <div>
            {React.Children.map(children, child => {
                if (React.isValidElement<{ tabsValue?: string; setTabsValue?: (val: string) => void }>(child)) {
                    return React.cloneElement(child, { tabsValue: value, setTabsValue: setValue });
                }
                return child;
            })}
        </div>
    );
}

export function TabsList({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={className}>{children}</div>;
}

export function TabsTrigger({ value, children, className, tabsValue, setTabsValue }: { value: string, children: React.ReactNode, className?: string, tabsValue?: string, setTabsValue?: (val: string) => void }) {
    return <button className={className + (tabsValue === value ? " bg-gray-200" : "")} onClick={() => setTabsValue && setTabsValue(value)}>{children}</button>;
}

export function TabsContent({ value, children, tabsValue, className }: { value: string, children: React.ReactNode, tabsValue?: string, className?: string }) {
    if (tabsValue !== value) return null;
    return <div className={className}>{children}</div>;
}
