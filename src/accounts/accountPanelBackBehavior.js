export const getAccountPanelBackState = ({
  currentStep,
  isEditingProfile,
  viewMode,
  showPremiumPanel,
  showPremiumProPanel,
  showSubscriptionModal,
}) => {
  if (showPremiumPanel) {
    return { kind: 'close-premium-panel' };
  }

  if (showPremiumProPanel) {
    return { kind: 'close-premium-pro-panel' };
  }

  if (showSubscriptionModal) {
    return { kind: 'close-subscription-modal' };
  }

  if (viewMode === 'steps' && currentStep > 1) {
    return { kind: 'previous-step' };
  }

  if (isEditingProfile) {
    return { kind: 'exit-edit-mode' };
  }

  if (viewMode === 'steps' && currentStep === 1) {
    return { kind: 'close-panel' };
  }

  return { kind: 'close-panel' };
};
