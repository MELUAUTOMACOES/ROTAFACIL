import sys
import json
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

data = json.load(sys.stdin)
matrix = data["matrix"]
terminar_no_ponto_inicial = data.get("terminarNoPontoInicial", False)

print("=== DEBUG Python ===", file=sys.stderr)
print("terminar_no_ponto_inicial:", terminar_no_ponto_inicial, file=sys.stderr)
print("Matriz tem", len(matrix), "pontos.", file=sys.stderr)
sys.stdout.flush()


def create_data_model():
    return {'distance_matrix': matrix, 'num_vehicles': 1, 'depot': 0}


def main():
    data_model = create_data_model()
    if terminar_no_ponto_inicial:
        # Circular
        manager = pywrapcp.RoutingIndexManager(len(matrix), 1, 0)
    else:
        # Aberta: termina no ponto mais distante do início
        start = 0
        # Pega o índice do mais distante
        distancias = [matrix[start][i] for i in range(len(matrix))]
        end = distancias.index(max(distancias))
        manager = pywrapcp.RoutingIndexManager(len(matrix), 1, [start], [end])

    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int(data_model['distance_matrix'][from_node][to_node])

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH)
    search_parameters.time_limit.seconds = 10

    solution = routing.SolveWithParameters(search_parameters)

    result = {'order': [], 'totalDistance': 0, 'totalTime': 0, 'legs': []}
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
                next_node = manager.IndexToNode(index)
                leg_distance = data_model['distance_matrix'][node_index][
                    next_node]
                legs.append({
                    'from': node_index,
                    'to': next_node,
                    'distance': leg_distance,
                    'duration': leg_distance // 60
                })
                total_distance += leg_distance
        # Adiciona o último nó do trajeto
        last_node = manager.IndexToNode(index)
        route.append(last_node)
        result['order'] = route
        result['totalDistance'] = total_distance
        result['legs'] = legs
        result['totalTime'] = total_distance // 60
    else:
        result['error'] = 'No solution found!'
    print(json.dumps(result))


if __name__ == "__main__":
    main()
