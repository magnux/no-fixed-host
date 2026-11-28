// Enter through the same title screen and opening chapter as a first-time player.
export async function startCampaign(page) {
  await page.getByRole('button', { name: 'Start campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Skip / close story', exact: true }).click();
}
