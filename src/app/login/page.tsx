import { LoginForm } from "@/components/auth/LoginForm";

export default function Login() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold tracking-tight">NOSTR App</h1>
                    <p className="mt-2 text-muted-foreground">
                        Connect to the decentralized social network
                    </p>
                </div>
                <LoginForm />
                <p className="text-center text-xs text-muted-foreground">
                    A decentralized social network based on the NOSTR protocol
                </p>
            </div>
        </div>
    );
}
