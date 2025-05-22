// Custom type declaration for lucide-react

declare module "lucide-react" {
    import * as React from "react";

    export interface LucideProps extends React.SVGProps<SVGSVGElement> {
        size?: string | number;
    }

    export const Wallet: React.FC<LucideProps>;
    // Add other icons as needed
}
