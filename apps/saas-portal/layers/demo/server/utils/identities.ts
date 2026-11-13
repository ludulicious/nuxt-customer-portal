export const demoIdentities = [
  {
    id: 'demo-admin',
    name: 'Alex Morgan',
    role: 'admin',
    memberRole: 'owner',
    organizationId: 'demo-studio',
    label: 'System administrator',
    labelNl: 'Systeembeheerder'
  },
  {
    id: 'demo-owner',
    name: 'Robin de Vries',
    role: 'user',
    memberRole: 'owner',
    organizationId: 'demo-studio',
    label: 'Studio owner',
    labelNl: 'Studio-eigenaar'
  },
  {
    id: 'demo-manager',
    name: 'Sam Bakker',
    role: 'user',
    memberRole: 'admin',
    organizationId: 'demo-studio',
    label: 'Studio administrator',
    labelNl: 'Studiobeheerder'
  },
  {
    id: 'demo-member',
    name: 'Jamie Chen',
    role: 'user',
    memberRole: 'member',
    organizationId: 'demo-studio',
    label: 'Team member',
    labelNl: 'Teamlid'
  },
  {
    id: 'demo-client-owner',
    name: 'Noor Jansen',
    role: 'user',
    memberRole: 'owner',
    organizationId: 'demo-garden',
    label: 'Client owner',
    labelNl: 'Klanteigenaar'
  },
  {
    id: 'demo-client-admin',
    name: 'Taylor Singh',
    role: 'user',
    memberRole: 'admin',
    organizationId: 'demo-garden',
    label: 'Client administrator',
    labelNl: 'Klantbeheerder'
  },
  {
    id: 'demo-client-member',
    name: 'Casey Vos',
    role: 'user',
    memberRole: 'member',
    organizationId: 'demo-garden',
    label: 'Client member',
    labelNl: 'Klantlid'
  }
] as const
