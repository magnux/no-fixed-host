// Enter through the same title screen and opening chapter as a first-time player.
export async function startCampaign(page) {
  await page.getByRole('button', { name: 'Start campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Skip / close story', exact: true }).click();
}

export async function openTesterFromCampaign(page) {
  await page.locator('#menu summary').click();
  await page.locator('#menu [data-shell-open="about"]').click();
  await page.getByRole('dialog', { name: 'About' }).getByRole('button', { name: 'Minigame tester' }).click();
}
