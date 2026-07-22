import React, { useEffect } from 'react';

export const AppSecurityWrapper = ({ children }: { children: React.ReactNode }) => {
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            // Allow context menu only on inputs and textareas
            const target = e.target as HTMLElement;
            if (
                target.tagName !== 'INPUT' &&
                target.tagName !== 'TEXTAREA' &&
                !target.isContentEditable
            ) {
                e.preventDefault();
            }
        };

        const handleDragStart = (e: DragEvent) => {
            // Prevent dragging of any element
            e.preventDefault();
        };
        
        const handleSelectStart = (e: Event) => {
             // Allow selection only on inputs and textareas
            const target = e.target as HTMLElement;
            if (
                target.tagName !== 'INPUT' &&
                target.tagName !== 'TEXTAREA' &&
                !target.isContentEditable
            ) {
                e.preventDefault();
            }
        };

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('selectstart', handleSelectStart);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('dragstart', handleDragStart);
            document.removeEventListener('selectstart', handleSelectStart);
        };
    }, []);

    return <>{children}</>;
};
