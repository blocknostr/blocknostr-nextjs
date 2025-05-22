import { useState, useEffect } from "react";
import { useNostr } from "@/hooks/useNostr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";
import { useRouter } from "next/navigation";

// Add a type declaration for window.nostr to fix TS errors
// This must be at the top level, not inside the component
// If already present, ensure it's not duplicated

// Minimal WindowNostr interface for extension compatibility
interface WindowNostr {
    getPublicKey: () => Promise<string>;
    // Add other methods if needed
}

declare global {
    interface Window {
        nostr?: WindowNostr;
    }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const nostr = typeof window !== 'undefined' ? (window as any).nostr : undefined;

export function LoginForm() {
    const { login, pubkey } = useNostr();
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    // Consider authenticated if pubkey exists
    useEffect(() => {
        if (pubkey) {
            router.push('/profile');
        }
    }, [pubkey, router]);

    const handleExtensionLogin = () => {
        setIsLoading(true);
        try {
            if (typeof window !== 'undefined' && window.nostr) {
                window.nostr.getPublicKey().then((pubkey: string) => {
                    if (pubkey) {
                        login();
                        toast({
                            title: 'Logged in with extension',
                            description: 'Successfully logged in with your NOSTR extension',
                        });
                        router.push('/profile');
                    } else {
                        throw new Error('No public key found in extension');
                    }
                }).catch((err: unknown) => {
                    console.error('Error getting public key from extension:', err);
                    toast({
                        title: 'Extension error',
                        description: 'Could not get your public key from the extension',
                        variant: 'destructive',
                    });
                }).finally(() => {
                    setIsLoading(false);
                });
            } else {
                toast({
                    title: 'No NOSTR extension found',
                    description: 'Please install a NOSTR extension like nos2x or Alby',
                    variant: 'destructive',
                });
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Extension login error:', error);
            toast({
                title: 'Login failed',
                description: 'Error connecting to your NOSTR extension',
                variant: 'destructive',
            });
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl">Welcome to NOSTR App</CardTitle>
                <CardDescription>
                    Connect with the decentralized social network
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Tabs defaultValue="extension">
                    <TabsList className="grid w-full grid-cols-1">
                        <TabsTrigger value="extension" className="flex items-center justify-center gap-2">
                            <Wallet className="h-4 w-4" />
                            <span className="hidden sm:inline">Extension</span>
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="extension" className="space-y-4 pt-4">
                        <div className="text-sm text-muted-foreground mb-6">
                            <p>Connect using your NOSTR browser extension</p>
                            <p className="mt-2 text-xs">Supported: nos2x, Alby, Flamingo, etc.</p>
                        </div>
                        <Button
                            className="w-full"
                            onClick={handleExtensionLogin}
                            disabled={isLoading}
                        >
                            <Wallet className="mr-2 h-4 w-4" />
                            Connect Extension
                        </Button>
                    </TabsContent>
                </Tabs>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
                <div className="text-xs text-muted-foreground text-center">
                    <p>By logging in or creating an account, you agree to the</p>
                    <p>terms of service and privacy policy</p>
                </div>
            </CardFooter>
        </Card>
    );
}
