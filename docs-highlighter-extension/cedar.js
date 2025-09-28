// This file contains the React component that will be injected into the page.
// It is kept separate to keep the main content.js file cleaner.

const CedarApp = () => {
    // State to control the visibility, position, and context of the radial menu
    const [spellState, setSpellState] = React.useState({
        visible: false,
        top: 0,
        left: 0,
        context: '',
    });

    React.useEffect(() => {
        // Listener for the custom event to show the menu
        const handleShowMenu = (event) => {
            const { top, left, context } = event.detail;
            setSpellState({ visible: true, top, left, context });
        };

        // Listener for the custom event to hide the menu
        const handleHideMenu = () => {
            setSpellState(prevState => ({ ...prevState, visible: false }));
        };

        // Attach listeners to the window
        window.addEventListener('showRadialMenu', handleShowMenu);
        window.addEventListener('hideRadialMenu', handleHideMenu);

        // Cleanup listeners on component unmount
        return () => {
            window.removeEventListener('showRadialMenu', handleShowMenu);
            window.removeEventListener('hideRadialMenu', handleHideMenu);
        };
    }, []);

    // Define the items for our radial menu
    const menuItems = [
        {
            id: 'fact-check-wiki',
            label: 'Fact Check with Wikipedia',
            onSelect: (context) => {
                console.log(`WIKIPEDIA CHECK on: "${context}"`);
                // Hide the menu after selection
                setSpellState(prevState => ({ ...prevState, visible: false }));
            },
        },
        {
            id: 'fact-check-textbook',
            label: 'Fact Check with Textbook',
            onSelect: (context) => {
                console.log(`TEXTBOOK CHECK on: "${context}"`);
                // Hide the menu after selection
                setSpellState(prevState => ({ ...prevState, visible: false }));
            },
        },
    ];

    // Conditionally render the menu based on the 'visible' state
    if (!spellState.visible) {
        return null;
    }

    // The component uses a simple div to position the Cedar component,
    // as programmatic control is handled via state.
    return React.createElement(
        'div',
        {
            style: {
                position: 'fixed',
                top: `${spellState.top}px`,
                left: `${spellState.left}px`,
                zIndex: 20000, // Ensure it's on top
            },
        },
        // Using React.createElement because JSX is not available here
        React.createElement(Cedar.Spell, {
            spell: React.createElement(Cedar.RadialMenuSpell, {
                items: menuItems,
                // Pass the highlighted text as context to onSelect
                context: spellState.context,
                // We are controlling visibility manually, so no activation is needed here.
                // However, the component requires an activation prop.
                activation: { type: 'manual' },
            }),
        })
    );
};

// This function will be called from content.js after React is loaded
window.renderCedarApp = () => {
    const cedarRoot = document.createElement('div');
    cedarRoot.id = 'cedar-fact-checker-root';
    document.body.appendChild(cedarRoot);
    ReactDOM.render(React.createElement(CedarApp), cedarRoot);
};
