import "./App.css";
import "./help/help-styles.css";
import { Tabs, Panels, WizardManager, TutorialOverlay } from "./components";
import { EditorDialogs } from "./components/EditorDialogs";
import { EditorStoreProvider, useEditorFields } from "./context/EditorStoreContext";
import { useMessageHandler } from "./hooks/useMessageHandler";
import { useWizardEffects } from "./hooks/useWizardEffects";
import { useEditorEffects } from "./hooks/useEditorEffects";

const vscodeApi = acquireVsCodeApi();

export function App() {
  return (
    <EditorStoreProvider vscodeApi={vscodeApi}>
      <AppContent />
    </EditorStoreProvider>
  );
}

function AppContent() {
  useMessageHandler();
  useWizardEffects();
  useEditorEffects();
  const { configurations, selectedTab } = useEditorFields("configurations", "selectedTab");
  return (
    <div className="app-container" data-testid="config-editor-app" data-config-count={configurations.length} data-selected-tab={selectedTab}>
      <Tabs />
      <Panels />
      <EditorDialogs />
      <WizardManager />
      <EditorTutorial />
    </div>
  );
}

function EditorTutorial() {
  const { showTutorial, selectedProfileKey, handleProfileSelection, dismissTutorial } = useEditorFields(
    "showTutorial",
    "selectedProfileKey",
    "handleProfileSelection",
    "dismissTutorial"
  );
  return showTutorial ? (
    <TutorialOverlay selectedProfileKey={selectedProfileKey} onSelectProfile={handleProfileSelection} onClose={dismissTutorial} />
  ) : null;
}
