import { Injectable } from '@nestjs/common'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import { Query } from '../../building-blocks/types/query'
import { Result, success } from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { PROFILS_JEUNES_ACCOMPAGNES } from '../../domain/profil'
import { JeuneAuthorizer } from '../authorizers/jeune-authorizer'
import { NotificationJeuneSqlModel } from '../../infrastructure/sequelize/models/notification-jeune.sql-model'

export class NotificationJeuneQueryModel {
  @ApiProperty()
  id: string

  @ApiProperty()
  date: string

  @ApiProperty()
  type: string

  @ApiProperty()
  titre: string

  @ApiProperty()
  description: string

  @ApiPropertyOptional({ required: false })
  idObjet?: string
}

export interface GetNotificationsJeuneQuery extends Query {
  idJeune: string
}

@Injectable()
export class GetNotificationsJeuneQueryHandler extends QueryHandler<
  GetNotificationsJeuneQuery,
  Result<NotificationJeuneQueryModel[]>
> {
  readonly profilsAutorises = PROFILS_JEUNES_ACCOMPAGNES

  constructor(private readonly jeuneAuthorizer: JeuneAuthorizer) {
    super('GetNotificationsJeuneQueryHandler')
  }

  async handle(
    query: GetNotificationsJeuneQuery
  ): Promise<Result<NotificationJeuneQueryModel[]>> {
    const sqlNotifs = await NotificationJeuneSqlModel.findAll({
      where: { idJeune: query.idJeune },
      order: [['dateNotif', 'DESC']]
    })

    return success(
      sqlNotifs.map(sqlNotif => ({
        id: sqlNotif.id,
        date: sqlNotif.dateNotif.toISOString(),
        type: sqlNotif.type,
        titre: sqlNotif.titre,
        description: sqlNotif.description,
        idObjet: sqlNotif.idObjet || undefined
      }))
    )
  }

  async authorize(
    query: GetNotificationsJeuneQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(query.idJeune, utilisateur)
  }

  async monitor(): Promise<void> {
    return
  }
}
