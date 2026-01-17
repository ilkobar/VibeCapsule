import { Wand2 } from 'lucide-react';

const FAB = () => {
    const handleClick = () => {
        chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
    };

    // Inline styles for simplicity and isolation in Shadow DOM
    const style = {
        button: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '28px',
            backgroundColor: '#6366f1', // Indigo 500
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transition: 'transform 0.2s, background-color 0.2s',
            zIndex: 999999,
            position: 'fixed' as const,
            bottom: '32px',
            right: '32px',
        },
        icon: {
            width: '24px',
            height: '24px',
        }
    };

    return (
        <button
            onClick={handleClick}
            style={style.button}
            className="vibe-capsule-fab"
            title="Summarize with VibeCapsule"
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
        >
            <Wand2 size={24} />
        </button>
    );
};

export default FAB;
