import { getAccountPanelBackState } from './accountPanelBackBehavior';

describe('getAccountPanelBackState', () => {
  it('returns a previous-step action when the form is beyond the first step', () => {
    expect(
      getAccountPanelBackState({
        currentStep: 3,
        isEditingProfile: true,
        viewMode: 'steps',
      })
    ).toEqual({ kind: 'previous-step' });
  });

  it('returns an exit-edit-mode action when the user is on the first step of the form while editing', () => {
    expect(
      getAccountPanelBackState({
        currentStep: 1,
        isEditingProfile: true,
        viewMode: 'steps',
      })
    ).toEqual({ kind: 'exit-edit-mode' });
  });

  it('returns a close-panel action when the user is on the first step and not editing', () => {
    expect(
      getAccountPanelBackState({
        currentStep: 1,
        isEditingProfile: false,
        viewMode: 'steps',
      })
    ).toEqual({ kind: 'close-panel' });
  });

  it('prefers the subscription modal close action when that modal is open', () => {
    expect(
      getAccountPanelBackState({
        currentStep: 1,
        isEditingProfile: true,
        viewMode: 'steps',
        showSubscriptionModal: true,
      })
    ).toEqual({ kind: 'close-subscription-modal' });
  });
});
