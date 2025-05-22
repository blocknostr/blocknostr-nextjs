interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'h-4 w-4 border-2',
        md: 'h-8 w-8 border-2',
        lg: 'h-12 w-12 border-3',
    };

    return (
        <div className="flex flex-col items-center justify-center">
            <div className={`animate-spin rounded-full border-t-blue-500 border-blue-500/20 ${sizeClasses[size]}`} />
        </div>
    );
}
