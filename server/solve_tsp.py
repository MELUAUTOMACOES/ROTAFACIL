import sys
import json
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

# Lê dados do Node.js
data = json.load(sys.stdin)
matrix = data["matrix"]
terminar_no_ponto_inicial = data.get("terminarNoPontoInicial", False)

def create_data_model():
    return {
        'distance_matrix': matrix,
        'num_vehicles': 1,
        'depot': 0  # ponto inicial sempre é o 0
    }

def main():
    data_model = create_data_model()
    manager = pywrapcp.RoutingIndexManager(
        len(data_model['distance_matrix']),
        data_model['num_vehicles'],
        data_model['depot'],
    )

    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int(data_model['distance_matrix'][from_node][to_node])

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # LÓGICA DO FIM DA ROTA
    if terminar_no_ponto_inicial:
        # Rota circular: não adiciona restrições especiais, permitindo que retorne ao início
        pass
    else:
        # Rota aberta: minimiza a variável do último nó para não retornar ao início
        for node in range(1, len(matrix)):
            routing.AddVariableMinimizedByFinalizer(routing.NextVar(manager.NodeToIndex(node)))

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.seconds = 10

    solution = routing.SolveWithParameters(search_parameters)

    result = {
        'order': [],
        'totalDistance': 0,
        'totalTime': 0,
        'legs': []
    }

    if solution:
        index = routing.Start(0)
        route = []
        total_distance = 0
        legs = []

        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            route.append(node_index)

            previous_index = index
            index = solution.Value(routing.NextVar(index))
            if not routing.IsEnd(index):
                # Distância do trecho atual
                next_node = manager.IndexToNode(index)
                leg_distance = data_model['distance_matrix'][node_index][next_node]
                legs.append({
                    'from': node_index,
                    'to': next_node,
                    'distance': leg_distance,
                    'duration': leg_distance // 60  # se matriz em segundos (exemplo)
                })
                total_distance += leg_distance

        # Adiciona o último nó do trajeto
        last_node = manager.IndexToNode(index)
        route.append(last_node)

        result['order'] = route
        result['totalDistance'] = total_distance  # em metros ou segundos conforme matriz
        result['legs'] = legs
        # Para tempo total, se matriz for em segundos: total_distance // 60 (minutos)
        result['totalTime'] = total_distance // 60
    else:
        result['error'] = 'No solution found!'

    print(json.dumps(result))

if __name__ == "__main__":
    main()
