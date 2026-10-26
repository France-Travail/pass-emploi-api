import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DateTime } from 'luxon'
import { parseArgs } from 'node:util'
import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'
import configuration from '../config/configuration'
import { ArchiveJeune } from '../domain/archive-jeune'
import { Chat, ChatRepositoryToken } from '../domain/chat'
import { FirebaseClient } from '../infrastructure/clients/firebase-client'
import { initializeAPMAgent } from '../infrastructure/monitoring/apm.init'
import { ChatFirebaseRepository } from '../infrastructure/repositories/chat-firebase.repository'
import { MigrationSqlRepository } from '../infrastructure/repositories/migration.repository.db'
import {
  databaseProviders,
  SequelizeInjectionToken
} from '../infrastructure/sequelize/providers'
import { ChatCryptoService } from '../utils/chat-crypto-service'
import { DateService } from '../utils/date-service'

export const PREFIXE = 'demo-migr-'

export const ID_POPULATION = `${PREFIXE}population`
const MOTIF_PREFIXE = `${PREFIXE}%`
const CONSEILLER_FICTIF = {
  id: `${PREFIXE}conseiller`,
  email: `${PREFIXE}conseiller@example.com`
}
const CONSEILLER_TEMOIN = {
  id: `${PREFIXE}conseiller-temoin`,
  email: `${PREFIXE}conseiller-temoin@example.com`
}

const ENVIRONNEMENTS_AUTORISES = ['staging', 'development']
const COMMANDES = ['semer', 'nettoyer', 'etat'] as const
type Commande = (typeof COMMANDES)[number]

const USAGE = `Usage : yarn seed:population-fictive <semer|nettoyer|etat> [options]
Population de jeunes fictifs (préfixe ${PREFIXE}) pour tester à la main l'archivage de migration, le nettoyage des archives et le désarchivage.
Staging : scalingo --app pass-emploi-api-staging run yarn seed:population-fictive <commande>
  semer     nettoie un semis précédent, puis sème conseiller, jeunes, chats, population ${PREFIXE}population et déploiement MIGRATION
            --email-conseiller <email>  rattache les jeunes à ce conseiller existant (refusé s'il suit un jeune réel)
            --mails <prenom@domaine>    rend une partie des jeunes actifs, emails prenom+<id jeune>@domaine : ils recevront le mail d'archivage
  etat      pour chaque jeune fictif : en base ou archivé, état du nettoyage, chat Firestore
  nettoyer  supprime tout ce qui porte le préfixe : jeunes, archives, conseillers, population, déploiement, chats`

export interface Arguments {
  commande: Commande
  emailConseiller?: string
  mails?: string
}

export function verifierEnvironnement(environnement: string | undefined): void {
  if (!ENVIRONNEMENTS_AUTORISES.includes(environnement as string)) {
    throw new Error(
      `ENVIRONMENT=${JSON.stringify(environnement)} : ce script ne tourne qu'en ${ENVIRONNEMENTS_AUTORISES.join(' ou ')}`
    )
  }
}

export function lireArguments(argv: string[]): Arguments {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'email-conseiller': { type: 'string' },
      mails: { type: 'string' }
    }
  })
  const [commande, ...enTrop] = positionals
  const avecOptions = Object.keys(values).length > 0
  if (
    !COMMANDES.includes(commande as Commande) ||
    enTrop.length ||
    (avecOptions && commande !== 'semer')
  ) {
    throw new Error(USAGE)
  }
  if (values.mails !== undefined && values.mails.split('@').length !== 2) {
    throw new Error(
      `--mails attend une adresse prenom@domaine : ${values.mails}`
    )
  }
  return {
    commande: commande as Commande,
    ...(values['email-conseiller'] && {
      emailConseiller: values['email-conseiller']
    }),
    ...(values.mails && { mails: values.mails })
  }
}

export interface JeuneFictif {
  id: string
  idAuthentification: string
  prenom: string
  nom: string
  email: string
  actif: boolean
  avecChat: boolean
  temoin: boolean
}

const JEUNES = [
  { numero: '000000', actifAvecMails: true, avecChat: true, temoin: false },
  { numero: '000001', actifAvecMails: true, avecChat: false, temoin: false },
  { numero: '000002', actifAvecMails: false, avecChat: true, temoin: false },
  { numero: '000003', actifAvecMails: false, avecChat: false, temoin: false },
  { numero: '000000', actifAvecMails: true, avecChat: true, temoin: true }
]

export function construireJeunesFictifs(mails?: string): JeuneFictif[] {
  return JEUNES.map(({ numero, actifAvecMails, avecChat, temoin }) => {
    const suffixe = temoin ? `temoin-${numero}` : numero
    const id = `${PREFIXE}${suffixe}`
    const emailReel =
      mails && actifAvecMails ? emailPlusAddressing(mails, id) : undefined
    return {
      id,
      idAuthentification: `${PREFIXE}auth-${suffixe}`,
      prenom: temoin ? 'Témoin' : 'Fictif',
      nom: `Demo ${suffixe}`,
      email: emailReel ?? `${id}@example.com`,
      actif: emailReel !== undefined,
      avecChat,
      temoin
    }
  })
}

function emailPlusAddressing(adresse: string, id: string): string {
  const [local, domaine] = adresse.split('@')
  return `${local}+${id}@${domaine}`
}

interface ConseillerCible {
  id: string
  email: string
  structure: string
  dispositif: string | null
}

export interface BilanSemis {
  conseiller: ConseillerCible
  idsCibles: string[]
  nbChats: number
}

export async function semer(
  sequelize: Sequelize,
  chatRepository: Chat.Repository,
  options: { emailConseiller?: string; mails?: string }
): Promise<BilanSemis> {
  const jeunes = construireJeunesFictifs(options.mails)

  const { conseiller, idsChatsASupprimer, idsCibles } =
    await sequelize.transaction(async () => {
      const { idsJeunes } = await nettoyerLaBase(sequelize)
      const conseillerCible = options.emailConseiller
        ? await trouverLeConseillerReel(sequelize, options.emailConseiller)
        : await creerUnConseillerFictif(sequelize, CONSEILLER_FICTIF)
      await creerUnConseillerFictif(sequelize, CONSEILLER_TEMOIN)
      await creerLesJeunes(sequelize, jeunes, conseillerCible)
      await creerLaPopulation(sequelize, conseillerCible.email)
      return {
        conseiller: conseillerCible,
        idsChatsASupprimer: idsJeunes,
        idsCibles: await verifierLeCiblage(sequelize, jeunes)
      }
    })

  await supprimerLesChats(chatRepository, idsChatsASupprimer)
  const jeunesAvecChat = jeunes.filter(jeune => jeune.avecChat)
  for (const jeune of jeunesAvecChat) {
    const idConseiller = jeune.temoin ? CONSEILLER_TEMOIN.id : conseiller.id
    await chatRepository.initializeChatIfNotExists(jeune.id, idConseiller)
    await chatRepository.restaurerMessagesIndividuels(
      jeune.id,
      idConseiller,
      messagesFictifs()
    )
  }

  return { conseiller, idsCibles, nbChats: jeunesAvecChat.length }
}

export interface BilanNettoyage {
  nbJeunes: number
  nbArchives: number
  nbChats: number
  conseillersGardes: string[]
}

export async function nettoyer(
  sequelize: Sequelize,
  chatRepository: Chat.Repository
): Promise<BilanNettoyage> {
  const { idsJeunes, ...bilan } = await sequelize.transaction(() =>
    nettoyerLaBase(sequelize)
  )
  await supprimerLesChats(chatRepository, idsJeunes)
  return { ...bilan, nbChats: idsJeunes.length }
}

export interface EtatJeuneFictif {
  id: string
  enBase: boolean
  archives: Array<{
    id: number
    nettoyageIdp: string | null
    nettoyageChat: string | null
    nbMessages: number
  }>
  chatFirestore: boolean
}

export interface EtatPopulation {
  jeunes: EtatJeuneFictif[]
  ciblesHorsPrefixe: string[]
}

export async function etat(
  sequelize: Sequelize,
  chatRepository: Chat.Repository
): Promise<EtatPopulation> {
  const idsEnBase = await idsDesJeunesFictifsEnBase(sequelize)
  const archives = await sequelize.query<{
    id: number
    id_jeune: string
    nettoyage_idp: string | null
    nettoyage_chat: string | null
    nb_messages: number
  }>(
    `SELECT id, id_jeune, nettoyage_idp, nettoyage_chat,
            CASE WHEN jsonb_typeof(donnees->'messages') = 'array'
                 THEN jsonb_array_length(donnees->'messages') ELSE 0 END AS nb_messages
       FROM archive_jeune
      WHERE id_jeune LIKE :motif
      ORDER BY id`,
    { replacements: { motif: MOTIF_PREFIXE }, type: QueryTypes.SELECT }
  )

  const ids = unionTriee(
    construireJeunesFictifs().map(({ id }) => id),
    idsEnBase,
    archives.map(archive => archive.id_jeune)
  )
  const jeunes: EtatJeuneFictif[] = []
  for (const id of ids) {
    jeunes.push({
      id,
      enBase: idsEnBase.includes(id),
      archives: archives
        .filter(archive => archive.id_jeune === id)
        .map(archive => ({
          id: archive.id,
          nettoyageIdp: archive.nettoyage_idp,
          nettoyageChat: archive.nettoyage_chat,
          nbMessages: archive.nb_messages
        })),
      chatFirestore: Boolean(
        await chatRepository.recupererConversationIndividuelle(id)
      )
    })
  }

  const cibles = await idsCiblesParLArchivage(sequelize)
  return {
    jeunes,
    ciblesHorsPrefixe: cibles.filter(id => !id.startsWith(PREFIXE))
  }
}

async function nettoyerLaBase(sequelize: Sequelize): Promise<{
  idsJeunes: string[]
  nbJeunes: number
  nbArchives: number
  conseillersGardes: string[]
}> {
  const replacements = { motif: MOTIF_PREFIXE }
  const archivees = await sequelize.query<{ id_jeune: string }>(
    'SELECT DISTINCT id_jeune FROM archive_jeune WHERE id_jeune LIKE :motif',
    { replacements, type: QueryTypes.SELECT }
  )
  const idsJeunes = unionTriee(
    construireJeunesFictifs().map(({ id }) => id),
    await idsDesJeunesFictifsEnBase(sequelize),
    archivees.map(({ id_jeune }) => id_jeune)
  )

  const nbArchives = await sequelize.query(
    'DELETE FROM archive_jeune WHERE id_jeune LIKE :motif',
    { replacements, type: QueryTypes.BULKDELETE }
  )
  const nbJeunes = await sequelize.query(
    'DELETE FROM jeune WHERE id LIKE :motif',
    { replacements, type: QueryTypes.BULKDELETE }
  )
  await sequelize.query(
    'DELETE FROM deploiement WHERE id_population LIKE :motif',
    { replacements, type: QueryTypes.BULKDELETE }
  )
  await sequelize.query('DELETE FROM population WHERE id LIKE :motif', {
    replacements,
    type: QueryTypes.BULKDELETE
  })
  // La suppression d'un conseiller emporte ses jeunes (ON DELETE CASCADE) : on garde celui qui suit encore un jeune réel
  await sequelize.query(
    `DELETE FROM conseiller c
      WHERE c.id LIKE :motif
        AND NOT EXISTS (
          SELECT 1 FROM jeune j
           WHERE j.id_conseiller = c.id OR j.id_conseiller_initial = c.id
        )`,
    { replacements, type: QueryTypes.BULKDELETE }
  )
  const gardes = await sequelize.query<{ id: string }>(
    'SELECT id FROM conseiller WHERE id LIKE :motif ORDER BY id',
    { replacements, type: QueryTypes.SELECT }
  )

  return {
    idsJeunes,
    nbJeunes,
    nbArchives,
    conseillersGardes: gardes.map(({ id }) => id)
  }
}

async function trouverLeConseillerReel(
  sequelize: Sequelize,
  email: string
): Promise<ConseillerCible> {
  const conseillers = await sequelize.query<ConseillerCible>(
    'SELECT id, email, structure, dispositif FROM conseiller WHERE email = :email',
    { replacements: { email }, type: QueryTypes.SELECT }
  )
  if (conseillers.length === 0) {
    throw new Error(`Aucun conseiller avec l'email ${email}`)
  }
  if (conseillers.length > 1) {
    throw new Error(
      `L'email ${email} est porté par plusieurs conseillers (${conseillers.map(({ id }) => id).join(', ')}) : la population les ciblerait tous`
    )
  }
  const [conseiller] = conseillers
  const jeunesReels = await sequelize.query<{ id: string }>(
    `SELECT id FROM jeune
      WHERE (id_conseiller = :id OR id_conseiller_initial = :id)
        AND id NOT LIKE :motif`,
    {
      replacements: { id: conseiller.id, motif: MOTIF_PREFIXE },
      type: QueryTypes.SELECT
    }
  )
  if (jeunesReels.length) {
    throw new Error(
      `Le conseiller ${email} suit des jeunes réels, que l'archivage emporterait : ${jeunesReels.map(({ id }) => id).join(', ')}`
    )
  }
  return conseiller
}

async function creerUnConseillerFictif(
  sequelize: Sequelize,
  { id, email }: { id: string; email: string }
): Promise<ConseillerCible> {
  const conseiller = {
    id,
    email,
    structure: 'FRANCE_TRAVAIL',
    dispositif: 'CEJ'
  }
  await sequelize.query(
    `INSERT INTO conseiller (id, prenom, nom, email, structure, dispositif, id_authentification)
     VALUES (:id, 'Conseiller', 'Fictif', :email, :structure, :dispositif, :idAuthentification)`,
    {
      replacements: {
        ...conseiller,
        idAuthentification: `${PREFIXE}auth-${id.slice(PREFIXE.length)}`
      }
    }
  )
  return conseiller
}

async function creerLesJeunes(
  sequelize: Sequelize,
  jeunes: JeuneFictif[],
  conseiller: ConseillerCible
): Promise<void> {
  for (const jeune of jeunes) {
    await sequelize.query(
      `INSERT INTO jeune (id, prenom, nom, email, id_authentification, id_conseiller,
                          structure, dispositif, date_creation,
                          date_premiere_connexion, date_derniere_connexion, date_derniere_activite)
       VALUES (:id, :prenom, :nom, :email, :idAuthentification, :idConseiller,
               :structure, :dispositif, NOW(),
               :dateActivite, :dateActivite, :dateActivite)`,
      {
        replacements: {
          id: jeune.id,
          prenom: jeune.prenom,
          nom: jeune.nom,
          email: jeune.email,
          idAuthentification: jeune.idAuthentification,
          idConseiller: jeune.temoin ? CONSEILLER_TEMOIN.id : conseiller.id,
          structure: jeune.temoin ? 'FRANCE_TRAVAIL' : conseiller.structure,
          dispositif: jeune.temoin ? 'CEJ' : (conseiller.dispositif ?? 'CEJ'),
          dateActivite: jeune.actif ? new Date() : null
        }
      }
    )
  }
}

async function creerLaPopulation(
  sequelize: Sequelize,
  emailConseiller: string
): Promise<void> {
  const replacements = { idPopulation: ID_POPULATION, emailConseiller }
  await sequelize.query(
    `INSERT INTO population (id, description)
     VALUES (:idPopulation, 'Population fictive de test de migration')`,
    { replacements }
  )
  await sequelize.query(
    `INSERT INTO population_conseiller (id_population, email_conseiller)
     VALUES (:idPopulation, :emailConseiller)`,
    { replacements }
  )
  await sequelize.query(
    `INSERT INTO deploiement (nature, id_population, id_fonctionnalite, date_activation)
     VALUES ('MIGRATION', :idPopulation, NULL, NOW())`,
    { replacements }
  )
}

// Lit les insertions non commitées : la requête du dépôt hérite de la transaction implicite (CLS) ouverte par semer
async function verifierLeCiblage(
  sequelize: Sequelize,
  jeunes: JeuneFictif[]
): Promise<string[]> {
  const cibles = await idsCiblesParLArchivage(sequelize)
  const attendus = jeunes
    .filter(jeune => !jeune.temoin)
    .map(({ id }) => id)
    .sort((a, b) => a.localeCompare(b))
  if (cibles.join() !== attendus.join()) {
    throw new Error(
      `La population ciblerait ${cibles.join(', ')} au lieu de ${attendus.join(', ')} : semis annulé`
    )
  }
  return cibles
}

async function idsCiblesParLArchivage(sequelize: Sequelize): Promise<string[]> {
  const beneficiaires = await new MigrationSqlRepository(
    sequelize
  ).getBeneficiairesAMigrerParProfilOuConseillerCite(ID_POPULATION)
  return beneficiaires.map(({ id }) => id).sort((a, b) => a.localeCompare(b))
}

async function idsDesJeunesFictifsEnBase(
  sequelize: Sequelize
): Promise<string[]> {
  const jeunes = await sequelize.query<{ id: string }>(
    'SELECT id FROM jeune WHERE id LIKE :motif',
    { replacements: { motif: MOTIF_PREFIXE }, type: QueryTypes.SELECT }
  )
  return jeunes.map(({ id }) => id)
}

async function supprimerLesChats(
  chatRepository: Chat.Repository,
  idsJeunes: string[]
): Promise<void> {
  for (const idJeune of idsJeunes) {
    if (!idJeune.startsWith(PREFIXE)) {
      throw new Error(`Chat hors préfixe refusé : ${idJeune}`)
    }
    await chatRepository.supprimerChat(idJeune)
  }
}

function messagesFictifs(): ArchiveJeune.Message[] {
  const maintenant = DateTime.now()
  return [
    {
      envoyePar: 'conseiller',
      contenu: 'Bonjour, comment avancent vos recherches ?',
      joursAvant: 3
    },
    {
      envoyePar: 'jeune',
      contenu: "J'ai envoyé deux candidatures cette semaine.",
      joursAvant: 2
    },
    {
      envoyePar: 'conseiller',
      contenu: 'Très bien, on en parle au prochain rendez-vous.',
      joursAvant: 1
    }
  ].map(({ envoyePar, contenu, joursAvant }) => ({
    envoyePar,
    contenu,
    type: 'MESSAGE',
    date: maintenant.minus({ days: joursAvant }).toJSDate().toISOString()
  }))
}

function unionTriee(...listes: string[][]): string[] {
  return [...new Set(listes.flat())].sort((a, b) => a.localeCompare(b))
}

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.environment', load: [configuration] })
  ],
  providers: [
    ...databaseProviders,
    ChatCryptoService,
    DateService,
    FirebaseClient,
    { provide: ChatRepositoryToken, useClass: ChatFirebaseRepository }
  ]
})
class PopulationFictiveModule {}

const logger = new Logger('PopulationFictive')

async function main(): Promise<void> {
  // Lecture brute voulue : la config retombe sur 'development' quand ENVIRONMENT manque, une prod mal configurée passerait
  verifierEnvironnement(process.env.ENVIRONMENT)
  const { commande, ...options } = lireArguments(process.argv.slice(2))

  const context = await NestFactory.createApplicationContext(
    PopulationFictiveModule,
    { logger: ['log', 'error', 'warn'] }
  )
  const sequelize = context.get<Sequelize>(SequelizeInjectionToken)
  const chatRepository = context.get<Chat.Repository>(ChatRepositoryToken)

  try {
    switch (commande) {
      case 'semer': {
        const bilan = await semer(sequelize, chatRepository, options)
        logger.log(
          `Conseiller ${bilan.conseiller.email} (${bilan.conseiller.id}), ${bilan.nbChats} chats`
        )
        logger.log(`Jeunes ciblés : ${bilan.idsCibles.join(', ')}`)
        logger.log(
          `Archiver : POST /support/archiver-jeunes-migration/${ID_POPULATION}, puis nettoyer : POST /support/nettoyer-archives-jeunes/${ID_POPULATION}`
        )
        break
      }
      case 'nettoyer': {
        const bilan = await nettoyer(sequelize, chatRepository)
        logger.log(
          `Supprimés : ${bilan.nbJeunes} jeunes, ${bilan.nbArchives} archives, chats de ${bilan.nbChats} jeunes`
        )
        if (bilan.conseillersGardes.length) {
          logger.warn(
            `Conseillers gardés, ils suivent encore des jeunes réels : ${bilan.conseillersGardes.join(', ')}`
          )
        }
        break
      }
      case 'etat': {
        const resultat = await etat(sequelize, chatRepository)
        for (const jeune of resultat.jeunes) {
          logger.log(decrireEtat(jeune))
        }
        if (resultat.ciblesHorsPrefixe.length) {
          logger.error(
            `ATTENTION, la population cible des jeunes réels : ${resultat.ciblesHorsPrefixe.join(', ')}. Lancer nettoyer avant tout archivage.`
          )
        }
        break
      }
    }
  } finally {
    await context.close()
  }
}

function decrireEtat(jeune: EtatJeuneFictif): string {
  const archives = jeune.archives.map(
    archive =>
      `archive ${archive.id} (nettoyage_idp=${archive.nettoyageIdp ?? 'fait'}, nettoyage_chat=${archive.nettoyageChat ?? 'fait'}, ${archive.nbMessages} messages archivés)`
  )
  return [
    jeune.id,
    jeune.enBase ? 'en base' : 'absent de la base',
    ...archives,
    jeune.chatFirestore ? 'chat Firestore présent' : 'pas de chat Firestore'
  ].join(' | ')
}

if (require.main === module) {
  initializeAPMAgent()
  main()
    .then(() => process.exit(0))
    .catch(err => {
      logger.error(err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
