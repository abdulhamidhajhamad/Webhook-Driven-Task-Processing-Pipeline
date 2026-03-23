import { ActionResult } from '../core/types';

export const fullNameAction = {
  async execute(
    payload: Record<string, unknown>,
    config: Record<string, unknown>
  ): Promise<ActionResult> {
    const firstName = payload[config.firstNameField as string ?? 'firstName'] as string;
    const lastName = payload[config.lastNameField as string ?? 'lastName'] as string;

    if (!firstName || !lastName) {
      throw new Error('firstName and lastName are required for fullName action');
    }

    return {
      filtered: false,
      data: {
        ...payload,
        fullName: `${firstName} ${lastName}`,
      },
    };
  },
};
